import { StemName } from '@lyria-studio/shared-types';

export interface TrackStemNode {
  name: StemName;
  buffer: AudioBuffer;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  isMuted: boolean;
  isSoloed: boolean;
  gain: number;
  pan: number;
}

/*
    - The Editor MFE is a browser-based multi-track DAW. 
    - When a track is sent to the editor, it initializes a job to demix the mixed audio into 4 distinct stems: Vocals, Drums, Bass, and Other (Instruments/Synths) using deep learning models (such as Demucs/Spleeter running via WebAssembly/ONNX workers or backend GPU clusters).
*/
export class MultitrackAudioEngine {
  private readonly ctx: AudioContext;
  private readonly stems: Map<StemName, TrackStemNode> = new Map();
  private readonly masterGain: GainNode;
  private isPlaying = false;
  private startTime = 0;
  private pauseOffset = 0;
  private onPlaybackEnded?: () => void;

  constructor(sharedContext: AudioContext, onPlaybackEnded?: () => void) {
    this.ctx = sharedContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.onPlaybackEnded = onPlaybackEnded;
  }

  async loadStem(name: StemName, audioUrl: string): Promise<void> {
    // Clean up existing nodes for this stem to prevent Web Audio graph memory leaks
    const existing = this.stems.get(name);
    if (existing) {
      existing.sourceNode?.stop();
      existing.sourceNode?.disconnect();
      existing.gainNode.disconnect();
      existing.panNode.disconnect();
    }

    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch stem '${name}' (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    const gainNode = this.ctx.createGain();
    const panNode = this.ctx.createStereoPanner();

    gainNode.connect(panNode);
    panNode.connect(this.masterGain);

    this.stems.set(name, {
      name,
      buffer: audioBuffer,
      sourceNode: null,
      gainNode,
      panNode,
      isMuted: false,
      isSoloed: false,
      gain: 1.0,
      pan: 0.0,
    });
  }

  /**
   * Recomputes effective gain for every stem based on the DAW Mute + Solo matrix:
   * - If ANY stem is Soloed, only soloed (and unmuted) stems are audible.
   * - Otherwise, all unmuted stems play at their individual fader gain.
   */
  private syncEffectiveGains(): void {
    const anySoloed = Array.from(this.stems.values()).some((s) => s.isSoloed);

    this.stems.forEach((stem) => {
      const isAudible = anySoloed ? stem.isSoloed && !stem.isMuted : !stem.isMuted;
      const targetGain = isAudible ? stem.gain : 0;
      stem.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.01);
    });
  }

  play(): void {
    if (this.isPlaying || this.stems.size === 0) return;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const firstStem = Array.from(this.stems.values())[0];
    if (firstStem && this.pauseOffset >= firstStem.buffer.duration) {
      this.pauseOffset = 0;
    }

    let attachedEndedHandler = false;

    this.stems.forEach((stem) => {
      const source = this.ctx.createBufferSource();
      source.buffer = stem.buffer;
      source.connect(stem.gainNode);

      if (!attachedEndedHandler) {
        attachedEndedHandler = true;
        source.onended = () => {
          if (this.isPlaying) {
            this.isPlaying = false;
            this.pauseOffset = 0;
            this.onPlaybackEnded?.();
          }
        };
      }

      source.start(0, this.pauseOffset);
      stem.sourceNode = source;
    });

    this.syncEffectiveGains();
    this.startTime = this.ctx.currentTime - this.pauseOffset;
    this.isPlaying = true;
  }

  pause(): void {
    if (!this.isPlaying) return;

    this.stems.forEach((stem) => {
      if (stem.sourceNode) {
        stem.sourceNode.onended = null;
        stem.sourceNode.stop();
        stem.sourceNode.disconnect();
        stem.sourceNode = null;
      }
    });

    this.pauseOffset = this.ctx.currentTime - this.startTime;
    this.isPlaying = false;
  }

  setGain(name: StemName, value: number): void {
    const stem = this.stems.get(name);
    if (stem) {
      stem.gain = Math.max(0, Math.min(1, value));
      this.syncEffectiveGains();
    }
  }

  setPan(name: StemName, value: number): void {
    const stem = this.stems.get(name);
    if (stem) {
      stem.pan = Math.max(-1, Math.min(1, value));
      stem.panNode.pan.setTargetAtTime(stem.pan, this.ctx.currentTime, 0.01);
    }
  }

  toggleMute(name: StemName): boolean {
    const stem = this.stems.get(name);
    if (!stem) return false;

    stem.isMuted = !stem.isMuted;
    this.syncEffectiveGains();
    return stem.isMuted;
  }

  toggleSolo(name: StemName): boolean {
    const stem = this.stems.get(name);
    if (!stem) return false;

    stem.isSoloed = !stem.isSoloed;
    this.syncEffectiveGains();
    return stem.isSoloed;
  }

  async exportMasterMix(): Promise<Blob> {
    const firstStem = Array.from(this.stems.values())[0];
    if (!firstStem) throw new Error('No stems loaded to export');

    const offlineCtx = new OfflineAudioContext(
      firstStem.buffer.numberOfChannels,
      firstStem.buffer.length,
      firstStem.buffer.sampleRate
    );

    const anySoloed = Array.from(this.stems.values()).some((s) => s.isSoloed);

    this.stems.forEach((stem) => {
      const isAudible = anySoloed ? stem.isSoloed && !stem.isMuted : !stem.isMuted;
      if (!isAudible) return;

      const source = offlineCtx.createBufferSource();
      const gain = offlineCtx.createGain();
      const panner = offlineCtx.createStereoPanner();

      source.buffer = stem.buffer;
      gain.gain.value = stem.gain;
      panner.pan.value = stem.pan;

      source.connect(gain);
      gain.connect(panner);
      panner.connect(offlineCtx.destination);
      source.start(0);
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWav(renderedBuffer);
  }

  /**
   * Encodes an AudioBuffer into a standard 44-byte header 16-bit PCM WAV Blob.
   * Standard 16-bit PCM WAV encoding algorithm
   */
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const dataLength = buffer.length * numOfChan * 2;
    const totalLength = 44 + dataLength;
    const out = new DataView(new ArrayBuffer(totalLength));

    const writeAscii = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        out.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // Standard 44-byte RIFF/WAVE Header with exact byte offsets
    writeAscii(0, 'RIFF');
    out.setUint32(4, totalLength - 8, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    out.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    out.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    out.setUint16(22, numOfChan, true);
    out.setUint32(24, sampleRate, true);
    out.setUint32(28, sampleRate * numOfChan * 2, true); // ByteRate
    out.setUint16(32, numOfChan * 2, true); // BlockAlign
    out.setUint16(34, 16, true); // BitsPerSample
    writeAscii(36, 'data');
    out.setUint32(40, dataLength, true);

    const channels: Float32Array[] = [];
    for (let i = 0; i < numOfChan; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let pos = 44;
    for (let offset = 0; offset < buffer.length; offset++) {
      for (let ch = 0; ch < numOfChan; ch++) {
        const rawSample = channels[ch]?.[offset] ?? 0;
        const clamped = Math.max(-1, Math.min(1, rawSample));
        const intSample = (clamped < 0 ? clamped * 32768 : clamped * 32767) | 0;
        out.setInt16(pos, intSample, true);
        pos += 2;
      }
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }
}
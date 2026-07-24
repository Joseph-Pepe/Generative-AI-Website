export interface TrackStemNode {
  name: 'vocals' | 'drums' | 'bass' | 'other';
  buffer: AudioBuffer;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  isMuted: boolean;
  isSoloed: boolean;
  gain: number;
}

/*
    - The Editor MFE is a browser-based multi-track DAW. 
    - When a track is sent to the editor, it initializes a job to demix the mixed audio into 4 distinct stems: Vocals, Drums, Bass, and Other (Instruments/Synths) using deep learning models (such as Demucs/Spleeter running via WebAssembly/ONNX workers or backend GPU clusters).
*/

export class MultitrackAudioEngine {
  private ctx: AudioContext;
  private stems: Map<string, TrackStemNode> = new Map();
  private masterGain: GainNode;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseOffset: number = 0;

  constructor(sharedContext: AudioContext) {
    this.ctx = sharedContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  async loadStem(name: TrackStemNode['name'], audioUrl: string): Promise<void> {
    const response = await fetch(audioUrl);
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
    });
  }

  play(): void {
    if (this.isPlaying || this.stems.size === 0) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.stems.forEach((stem) => {
      const source = this.ctx.createBufferSource();
      source.buffer = stem.buffer;
      source.connect(stem.gainNode);
      source.start(0, this.pauseOffset);
      stem.sourceNode = source;
    });

    this.startTime = this.ctx.currentTime - this.pauseOffset;
    this.isPlaying = true;
  }

  pause(): void {
    if (!this.isPlaying) return;

    this.stems.forEach((stem) => {
      if (stem.sourceNode) {
        stem.sourceNode.stop();
        stem.sourceNode.disconnect();
        stem.sourceNode = null;
      }
    });

    this.pauseOffset = this.ctx.currentTime - this.startTime;
    this.isPlaying = false;
  }

  setGain(name: string, value: number): void {
    const stem = this.stems.get(name);
    if (stem) {
      stem.gain = value;
      if (!stem.isMuted) {
        stem.gainNode.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
      }
    }
  }

  toggleMute(name: string): boolean {
    const stem = this.stems.get(name);
    if (!stem) return false;

    stem.isMuted = !stem.isMuted;
    const targetGain = stem.isMuted ? 0 : stem.gain;
    stem.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.01);
    return stem.isMuted;
  }

  exportMasterMix(): Promise<Blob> {
    return new Promise((resolve) => {
      // Implement offline rendering using OfflineAudioContext
      const firstStem = Array.from(this.stems.values())[0];
      if (!firstStem) throw new Error('No stems to export');

      const offlineCtx = new OfflineAudioContext(
        firstStem.buffer.numberOfChannels,
        firstStem.buffer.length,
        firstStem.buffer.sampleRate
      );

      this.stems.forEach((stem) => {
        if (stem.isMuted) return;
        const source = offlineCtx.createBufferSource();
        const gain = offlineCtx.createGain();
        source.buffer = stem.buffer;
        gain.gain.value = stem.gain;
        source.connect(gain);
        gain.connect(offlineCtx.destination);
        source.start(0);
      });

      offlineCtx.startRendering().then((renderedBuffer) => {
        // Convert AudioBuffer to WAV Blob
        const wavBlob = this.audioBufferToWav(renderedBuffer);
        resolve(wavBlob);
      });
    });
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    // Standard 16-bit PCM WAV encoding algorithm
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    // Write WAV Header
    const setUint32 = (data: number) => { out.setUint32(pos, data, true); pos += 4; };
    const setUint16 = (data: number) => { out.setUint16(pos, data, true); pos += 2; };

    out.setUint32(0, 0x46464952, false); // "RIFF"
    setUint32(length - 8);
    out.setUint32(8, 0x45564157, false); // "WAVE"
    out.setUint32(12, 0x20746d66, false); // "fmt "
    setUint32(16);
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    out.setUint32(36, 0x61746164, false); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }
}
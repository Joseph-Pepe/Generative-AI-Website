import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSharedAudio } from 'host_container/providers/AudioProvider';
import { MultitrackAudioEngine } from '../engine/AudioEngine';
import { eventBus } from '@lyria-studio/event-bus';
import {
  GeneratedAudioTrack,
  StemName,
  StemUrls,
  createTraceparent,
} from '@lyria-studio/shared-types';

const STEMS: StemName[] = ['vocals', 'drums', 'bass', 'other'];
const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000';

export const DemixingWorkstation: React.FC = () => {
  const { audioCtx } = useSharedAudio();
  const engineRef = useRef<MultitrackAudioEngine | null>(null);

  const [activeTrack, setActiveTrack] = useState<GeneratedAudioTrack | null>(null);
  const [isDemixing, setIsDemixing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stemGains, setStemGains] = useState<Record<StemName, number>>({
    vocals: 1.0,
    drums: 1.0,
    bass: 1.0,
    other: 1.0,
  });
  const [mutedStems, setMutedStems] = useState<Record<StemName, boolean>>({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  });
  const [soloedStems, setSoloedStems] = useState<Record<StemName, boolean>>({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  });

  const triggerDemixingProcess = useCallback(async (track: GeneratedAudioTrack) => {
    setIsDemixing(true);
    setError(null);
    eventBus.emit('DEMIX:START_PROCESSING', { trackId: track.id });

    try {
      // Call Backend Gateway to initiate Hybrid HT-Demucs stem separation
      const res = await fetch(`${GATEWAY_URL}/api/v1/audio/demix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          traceparent: createTraceparent(),
        },
        body: JSON.stringify({ audioUrl: track.audioUrl, trackId: track.id }),
      });

      if (!res.ok) {
        throw new Error(`Demixing failed with HTTP ${res.status}`);
      }

      const stems = (await res.json()) as StemUrls;

      // Load individual stems into the Web Audio Engine
      if (engineRef.current) {
        await Promise.all([
          stems.vocalsUrl ? engineRef.current.loadStem('vocals', stems.vocalsUrl) : Promise.resolve(),
          stems.drumsUrl ? engineRef.current.loadStem('drums', stems.drumsUrl) : Promise.resolve(),
          stems.bassUrl ? engineRef.current.loadStem('bass', stems.bassUrl) : Promise.resolve(),
          stems.otherUrl ? engineRef.current.loadStem('other', stems.otherUrl) : Promise.resolve(),
        ]);
      }

      eventBus.emit('DEMIX:STEMS_READY', { trackId: track.id, stems });
    } catch (err) {
      console.error('Demixing failed:', err);
      setError(err instanceof Error ? err.message : 'Demixing failed');
    } finally {
      setIsDemixing(false);
    }
  }, []);

  useEffect(() => {
    if (audioCtx && !engineRef.current) {
      engineRef.current = new MultitrackAudioEngine(audioCtx, () => setIsPlaying(false));
    }

    const unsubscribe = eventBus.on('AUDIO:LOAD_INTO_EDITOR', ({ track, autoDemix }) => {
      setActiveTrack(track);
      if (autoDemix) {
        void triggerDemixingProcess(track);
      }
    });

    return () => {
      unsubscribe();
      engineRef.current?.pause();
    };
  }, [audioCtx, triggerDemixingProcess]);

  const handleGainChange = (stemName: StemName, val: number) => {
    setStemGains((prev) => ({ ...prev, [stemName]: val }));
    engineRef.current?.setGain(stemName, val);
  };

  const handleToggleMute = (stemName: StemName) => {
    if (!engineRef.current) return;
    const isNowMuted = engineRef.current.toggleMute(stemName);
    setMutedStems((prev) => ({ ...prev, [stemName]: isNowMuted }));
  };

  const handleToggleSolo = (stemName: StemName) => {
    if (!engineRef.current) return;
    const isNowSoloed = engineRef.current.toggleSolo(stemName);
    setSoloedStems((prev) => ({ ...prev, [stemName]: isNowSoloed }));
  };

  const togglePlayPause = () => {
    if (!engineRef.current) return;
    if (isPlaying) {
      engineRef.current.pause();
      setIsPlaying(false);
    } else {
      engineRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleExportWav = async () => {
    if (!engineRef.current) return;
    try {
      const wavBlob = await engineRef.current.exportMasterMix();
      const downloadUrl = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${activeTrack?.title || 'lyria-mix'}-master.wav`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('WAV Export failed:', err);
    }
  };

  return (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-white min-h-[500px]">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">🎛️ DAW & AI Stem Demixer</h2>
          <p className="text-xs text-slate-400">
            {activeTrack
              ? `Loaded: ${activeTrack.title}`
              : 'No track loaded. Generate music above or drag & drop.'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={togglePlayPause}
            disabled={!activeTrack || isDemixing}
            className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
            } disabled:opacity-50`}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play Multi-track'}
          </button>

          <button
            onClick={() => void handleExportWav()}
            disabled={!activeTrack || isDemixing}
            className="px-4 py-2 rounded-lg font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-all text-sm"
          >
            💾 Export WAV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs">
          ⚠️ {error}
        </div>
      )}

      {isDemixing ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-purple-500/30 rounded-xl bg-purple-950/10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4" />
          <p className="text-purple-300 font-semibold">AI Stem Separation in Progress...</p>
          <p className="text-xs text-slate-400 mt-1">
            Splitting audio into Vocals, Drums, Bass, and Synths via Demucs neural network.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {STEMS.map((stem) => (
            <div
              key={stem}
              className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-6"
            >
              <div className="w-28">
                <span className="uppercase font-bold text-sm tracking-wider text-slate-300 block">
                  {stem}
                </span>
                <span className="text-[10px] text-purple-400">
                  {mutedStems[stem] ? 'Muted' : soloedStems[stem] ? 'Soloed' : 'Ready'}
                </span>
              </div>

              {/* Waveform Visualization Mock/Canvas Container */}
              <div className="flex-1 h-12 bg-slate-950 rounded border border-slate-800/80 overflow-hidden relative flex items-center px-2">
                <div className="w-full h-4 bg-gradient-to-r from-purple-500/20 via-pink-500/40 to-purple-500/20 rounded animate-pulse" />
              </div>

              {/* Volume Slider */}
              <div className="w-36 flex items-center gap-2">
                <span className="text-xs text-slate-400">Vol</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={stemGains[stem]}
                  onChange={(e) => handleGainChange(stem, parseFloat(e.target.value))}
                  className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Mute / Solo Controls */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleToggleMute(stem)}
                  className={`w-8 h-8 rounded font-bold text-xs transition-colors flex items-center justify-center border ${
                    mutedStems[stem]
                      ? 'bg-rose-600 border-rose-400 text-white'
                      : 'bg-slate-800 hover:bg-rose-600/80 border-slate-700'
                  }`}
                  title={`Mute ${stem}`}
                >
                  M
                </button>
                <button
                  onClick={() => handleToggleSolo(stem)}
                  className={`w-8 h-8 rounded font-bold text-xs transition-colors flex items-center justify-center border ${
                    soloedStems[stem]
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-slate-800 hover:bg-amber-600/80 border-slate-700'
                  }`}
                  title={`Solo ${stem}`}
                >
                  S
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
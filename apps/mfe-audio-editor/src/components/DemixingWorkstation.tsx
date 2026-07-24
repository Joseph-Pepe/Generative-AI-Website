import React, { useEffect, useState, useRef } from 'react';
import { useSharedAudio } from 'host_container/providers/AudioProvider';
import { MultitrackAudioEngine } from '../engine/AudioEngine';
import { eventBus } from '@lyria-studio/event-bus';
import { GeneratedAudioTrack } from '@lyria-studio/shared-types';

export const DemixingWorkstation: React.FC = () => {
  const { audioCtx } = useSharedAudio();
  const engineRef = useRef<MultitrackAudioEngine | null>(null);
  const [activeTrack, setActiveTrack] = useState<GeneratedAudioTrack | null>(null);
  const [isDemixing, setIsDemixing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stemGains, setStemGains] = useState<{ [key: string]: number }>({
    vocals: 1.0, drums: 1.0, bass: 1.0, other: 1.0
  });

  useEffect(() => {
    if (audioCtx && !engineRef.current) {
      engineRef.current = new MultitrackAudioEngine(audioCtx);
    }

    const handleLoadTrack = async ({ track, autoDemix }: { track: GeneratedAudioTrack; autoDemix: boolean }) => {
      setActiveTrack(track);
      if (autoDemix) {
        await triggerDemixingProcess(track);
      }
    };

    const unsubscribe = eventBus.on('AUDIO:LOAD_INTO_EDITOR', handleLoadTrack);
    return () => { unsubscribe(); };
  }, [audioCtx]);

  const triggerDemixingProcess = async (track: GeneratedAudioTrack) => {
    setIsDemixing(true);
    eventBus.emit('DEMIX:START_PROCESSING', { trackId: track.id });

    try {
      // Call Backend Gateway to initiate Hybrid HT-Demucs stem separation
      const res = await fetch(`${import.meta.env.VITE_API_GATEWAY_URL}/api/v1/audio/demix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: track.audioUrl, trackId: track.id })
      });
      const stems = await res.json();

      // Load individual stems into the Web Audio Engine
      if (engineRef.current) {
        await Promise.all([
          engineRef.current.loadStem('vocals', stems.vocalsUrl),
          engineRef.current.loadStem('drums', stems.drumsUrl),
          engineRef.current.loadStem('bass', stems.bassUrl),
          engineRef.current.loadStem('other', stems.otherUrl),
        ]);
      }

      setIsDemixing(false);
      eventBus.emit('DEMIX:STEMS_READY', { trackId: track.id, stems });
    } catch (err) {
      console.error('Demixing failed:', err);
      setIsDemixing(false);
    }
  };

  const handleGainChange = (stemName: string, val: number) => {
    setStemGains(prev => ({ ...prev, [stemName]: val }));
    engineRef.current?.setGain(stemName, val);
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

  return (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-white min-h-[500px]">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🎛️ DAW & AI Stem Demixer
          </h2>
          <p className="text-xs text-slate-400">
            {activeTrack ? `Loaded: ${activeTrack.title}` : 'No track loaded. Generate music above or drag & drop.'}
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
        </div>
      </div>

      {isDemixing ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-purple-500/30 rounded-xl bg-purple-950/10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-purple-300 font-semibold">AI Stem Separation in Progress...</p>
          <p className="text-xs text-slate-400 mt-1">Splitting audio into Vocals, Drums, Bass, and Synths via Demucs neural network.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {['vocals', 'drums', 'bass', 'other'].map((stem) => (
            <div key={stem} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-6">
              <div className="w-28">
                <span className="uppercase font-bold text-sm tracking-wider text-slate-300 block">{stem}</span>
                <span className="text-[10px] text-purple-400">Ready</span>
              </div>

              {/* Waveform Visualization Mock/Canvas Container */}
              <div className="flex-1 h-12 bg-slate-950 rounded border border-slate-800/80 overflow-hidden relative flex items-center px-2">
                <div className="w-full h-4 bg-gradient-to-r from-purple-500/20 via-pink-500/40 to-purple-500/20 rounded animate-pulse"></div>
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
                  onClick={() => engineRef.current?.toggleMute(stem)}
                  className="w-8 h-8 rounded bg-slate-800 hover:bg-rose-600/80 font-bold text-xs transition-colors flex items-center justify-center border border-slate-700"
                >
                  M
                </button>
                <button className="w-8 h-8 rounded bg-slate-800 hover:bg-amber-600/80 font-bold text-xs transition-colors flex items-center justify-center border border-slate-700">
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
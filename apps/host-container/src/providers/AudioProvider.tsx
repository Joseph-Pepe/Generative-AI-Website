import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface AudioContextState {
  audioCtx: AudioContext | null;
  isUnlocked: boolean;
  unlockAudio: () => Promise<void>;
  masterGainNode: GainNode | null;
}

const AudioContextContext = createContext<AudioContextState | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [masterGainNode, setMasterGainNode] = useState<GainNode | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    // Initialize Web Audio API on mount
    const AudioContextClass = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    const ctx = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });
    const masterGain = ctx.createGain();

    // Master Brickwall Limiter: Prevents digital clipping when 4 stems sum together
    const masterLimiter = ctx.createDynamicsCompressor();
    masterLimiter.threshold.value = -1.0;
    masterLimiter.knee.value = 0.0;
    masterLimiter.ratio.value = 20.0;
    masterLimiter.attack.value = 0.003;
    masterLimiter.release.value = 0.1;

    masterGain.connect(masterLimiter);
    masterLimiter.connect(ctx.destination);

    const handleStateChange = () => {
      setIsUnlocked(ctx.state === 'running');
    };
    ctx.addEventListener('statechange', handleStateChange);
    handleStateChange();

    setAudioCtx(ctx);
    setMasterGainNode(masterGain);

    return () => {
      ctx.removeEventListener('statechange', handleStateChange);
      void ctx.close();
    };
  }, []);

  const unlockAudio = useCallback(async () => {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
        setIsUnlocked(true);
      } catch (err) {
        console.warn('AudioContext resume requires user gesture:', err);
      }
    } else if (audioCtx.state === 'running' && !isUnlocked) {
      setIsUnlocked(true);
    }
  }, [audioCtx, isUnlocked]);

  const contextValue = useMemo<AudioContextState>(
    () => ({
      audioCtx,
      masterGainNode,
      isUnlocked,
      unlockAudio,
    }),
    [audioCtx, masterGainNode, isUnlocked, unlockAudio]
  );

  return (
    <AudioContextContext.Provider value={contextValue}>
      <div
        onClick={!isUnlocked ? () => void unlockAudio() : undefined}
        onKeyDown={!isUnlocked ? () => void unlockAudio() : undefined}
      >
        {children}
      </div>
    </AudioContextContext.Provider>
  );
};

export const useSharedAudio = (): AudioContextState => {
  const context = useContext(AudioContextContext);
  if (!context) {
    throw new Error('useSharedAudio must be used within an AudioProvider');
  }
  return context;
};
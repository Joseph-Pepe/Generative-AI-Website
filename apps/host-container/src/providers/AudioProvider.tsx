import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

interface AudioContextState {
  audioCtx: AudioContext | null;
  isUnlocked: boolean;
  unlockAudio: () => Promise<void>;
  masterGainNode: GainNode | null;
}

const AudioContextContext = createContext<AudioContextState | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    // Initialize Web Audio API on mount
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtxRef.current = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });
    masterGainRef.current = audioCtxRef.current.createGain();
    masterGainRef.current.connect(audioCtxRef.current.destination);

    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  const unlockAudio = async () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
      setIsUnlocked(true);
    }
  };

  return (
    <AudioContextContext.Provider value={{
      audioCtx: audioCtxRef.current,
      masterGainNode: masterGainRef.current,
      isUnlocked,
      unlockAudio
    }}>
      <div onClick={unlockAudio} onKeyDown={unlockAudio}>
        {children}
      </div>
    </AudioContextContext.Provider>
  );
};

export const useSharedAudio = () => {
  const context = useContext(AudioContextContext);
  if (!context) throw new Error('useSharedAudio must be used within AudioProvider');
  return context;
};
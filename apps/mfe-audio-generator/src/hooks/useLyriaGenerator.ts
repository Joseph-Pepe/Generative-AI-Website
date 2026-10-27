import { useState, useRef, useEffect, useCallback } from 'react';
import { Lyria3Client, LyriaGenerationParams } from '../services/lyriaClient';
import { GeneratedAudioTrack } from '@lyria-studio/shared-types';
import { eventBus } from '@lyria-studio/event-bus';

const lyriaClient = new Lyria3Client();

// Custom React hooks and bridges the gap between UI components and API client.
export function useLyriaGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<GeneratedAudioTrack | null>(null);
  const [receivedBytes, setReceivedBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const activeObjectUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const revokePreviousAudioUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  // Prevent Blob memory leaks & cancel active streams if component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      revokePreviousAudioUrl();
    };
  }, [revokePreviousAudioUrl]);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
  }, []);

  const generateTrack = useCallback(
    async (params: LyriaGenerationParams) => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsGenerating(true);
      setReceivedBytes(0);
      setError(null);
      revokePreviousAudioUrl();
      setAudioUrl(null);
      setMetadata(null);

      const audioChunks: Uint8Array[] = [];
      let totalLength = 0;

      try {
        // 1. Initiate the real-time generator stream
        const stream = lyriaClient.streamMusicGeneration(params, abortController.signal);
        let finalMeta: GeneratedAudioTrack | null = null;

        // 2. Iterate manually to capture both YIELDED chunks and the RETURNED metadata
        while (true) {
          const { value, done } = await stream.next();

          if (done) {
            // When done is TRUE, TypeScript automatically narrows `value` to `GeneratedAudioTrack | undefined`!
            if (value) {
              finalMeta = value;
              setMetadata(value);
            }
            break; // Stream finished, exit loop
          }

          // When done is FALSE, TypeScript automatically narrows `value` to `Uint8Array`!
          if (value) {
            audioChunks.push(value);
            totalLength += value.length;
            setReceivedBytes(totalLength);
          }
        }

        // 3. Assemble full WAV blob for standard audio players or downloading
        const fullBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
          fullBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        const blob = new Blob([fullBuffer], { type: 'audio/wav' });
        const nextUrl = URL.createObjectURL(blob);
        activeObjectUrlRef.current = nextUrl;
        setAudioUrl(nextUrl);

        if (finalMeta) {
          eventBus.emit('LYRIA:GENERATION_COMPLETED', {
            track: { ...finalMeta, audioUrl: nextUrl },
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unexpected generation error';
        console.error('Generation Error:', message);
        setError(message);
      } finally {
        if (abortControllerRef.current === abortController) {
          setIsGenerating(false);
        }
      }
    },
    [revokePreviousAudioUrl]
  );

  return {
    generateTrack,
    cancelGeneration,
    isGenerating,
    audioUrl,
    metadata,
    receivedBytes,
    error,
  };
}
import { useState } from 'react';
import { Lyria3Client, LyriaGenerationParams } from '../services/lyriaClient';
import { GeneratedAudioTrack } from '@lyria-studio/shared-types';

const lyriaClient = new Lyria3Client();

// Custom React hooks and bridges the gap between UI components and API client.
export function useLyriaGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<GeneratedAudioTrack | null>(null);
  const [receivedBytes, setReceivedBytes] = useState(0);

  const generateTrack = async (params: LyriaGenerationParams) => {
    setIsGenerating(true);
    setReceivedBytes(0);
    setAudioUrl(null);
    setMetadata(null);

    const audioChunks: Uint8Array[] = [];
    let totalLength = 0;

    try {
      // 1. Initiate the real-time generator stream
      const stream = lyriaClient.streamMusicGeneration(params);

      // 2. Iterate manually to capture both YIELDED chunks and the RETURNED metadata
      while (true) {
        const { value, done } = await stream.next();

        if (done) {
          // When done is TRUE, TypeScript automatically narrows `value` to `GeneratedAudioTrack | undefined`!
          if (value) {
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
      setAudioUrl(URL.createObjectURL(blob));

    } catch (error) {
      console.error('Generation Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateTrack, isGenerating, audioUrl, metadata, receivedBytes };
}
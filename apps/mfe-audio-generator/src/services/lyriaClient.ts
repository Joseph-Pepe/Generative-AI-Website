import { GeneratedAudioTrack } from '@lyria-studio/shared-types';

// This Micro Frontend handles music generation by interfacing with the Google Gemini Lyria 3 API. 
// It accepts rich natural language prompts, applies structural guidance (tempo, key, instrumentation), and streams real-time audio chunks back to the user.
export interface LyriaGenerationParams {
  prompt: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  durationSeconds?: number;
  negativePrompt?: string;
}

export class Lyria3Client {
  private gatewayUrl: string;

  constructor(gatewayUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000') {
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Initiates a real-time audio stream from Gemini Lyria 3.
   * Yields binary audio chunks as they arrive for real-time Web Audio playback,
   * and returns the final GeneratedAudioTrack metadata upon stream completion.
   * Utilizes Server-Sent Events (SSE) or Fetch Streams to receive PCM/WAV chunks as they generate.
   */
  async *streamMusicGeneration(params: LyriaGenerationParams): AsyncGenerator<Uint8Array, GeneratedAudioTrack, unknown> {
    const response = await fetch(`${this.gatewayUrl}/api/v1/lyria/generate-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok || !response.body) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || `Lyria generation failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    let pendingMetadataBuffer: Uint8Array | null = null;
    let carryOverBuffer: Uint8Array = new Uint8Array(0);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      // Accumulate metadata if header was already found
      if (pendingMetadataBuffer) {
        const merged: Uint8Array = new Uint8Array(pendingMetadataBuffer.length + value.length);
        merged.set(pendingMetadataBuffer);
        merged.set(value, pendingMetadataBuffer.length);
        pendingMetadataBuffer = merged;
        continue;
      }

      // Merge leftover bytes from the end of the previous chunk to catch split .MET headers
      const chunkToProcess = carryOverBuffer.length > 0 
        ? this.concatBuffers(carryOverBuffer, value) 
        : value;

      const metIndex = this.findMetadataHeaderIndex(chunkToProcess);

      if (metIndex !== -1) {
        // Yield audio preceding .MET (subtracting carryOver offset)
        if (metIndex > 0) {
          yield chunkToProcess.slice(0, metIndex);
        }
        pendingMetadataBuffer = chunkToProcess.slice(metIndex + 4);
        carryOverBuffer = new Uint8Array(0);
      } else {
        // Retain last 3 bytes in carryOverBuffer in case .MET is split into the next chunk
        if (chunkToProcess.length >= 3) {
          const yieldableLength = chunkToProcess.length - 3;
          if (yieldableLength > 0) {
            yield chunkToProcess.slice(0, yieldableLength);
          }
          carryOverBuffer = chunkToProcess.slice(yieldableLength);
        } else {
          carryOverBuffer = chunkToProcess;
        }
      }
    }

    // Flush any leftover bytes in carryOverBuffer if stream ended without metadata
    if (!pendingMetadataBuffer && carryOverBuffer.length > 0) {
      yield carryOverBuffer;
    }

    // Parse accumulated metadata at stream end
    let trackMetadata: GeneratedAudioTrack | null = null;
    if (pendingMetadataBuffer && pendingMetadataBuffer.length > 0) {
      try {
        const jsonString = new TextDecoder().decode(pendingMetadataBuffer);
        trackMetadata = JSON.parse(jsonString);
      } catch (err) {
        throw new Error('Failed to parse track metadata JSON from stream end.');
      }
    }

    if (!trackMetadata) {
      throw new Error('Stream completed without returning track metadata.');
    }

    return trackMetadata;
  }

  private findMetadataHeaderIndex(chunk: Uint8Array): number {
    for (let i = 0; i <= chunk.length - 4; i++) {
      if (
        chunk[i] === 0x7f &&
        chunk[i + 1] === 0x4d &&
        chunk[i + 2] === 0x45 &&
        chunk[i + 3] === 0x54
      ) {
        return i;
      }
    }
    return -1;
  }

  private concatBuffers(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  }
}
import { GeneratedAudioTrack, ProblemDetail, createTraceparent } from '@lyria-studio/shared-types';

// This Micro Frontend handles music generation by interfacing with the Google Gemini Lyria 3 API. 
// It accepts rich natural language prompts, applies structural guidance (tempo, key, instrumentation), and streams real-time audio chunks back to the user.

export interface LyriaGenerationParams {
  prompt: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  durationSeconds?: number;
  negativePrompt?: string;
  useMock?: boolean;
}

export class Lyria3Client {
  private readonly gatewayUrl: string;

  constructor(gatewayUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000') {
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Streams binary PCM/WAV chunks from the gateway while propagating W3C traceparent headers,
   * supporting AbortSignal cancellation, and parsing RFC 9457 ProblemDetail error responses.
   * Initiates a real-time audio stream from Gemini Lyria 3.
   * Yields binary audio chunks as they arrive for real-time Web Audio playback,
   * and returns the final GeneratedAudioTrack metadata upon stream completion.
   * Utilizes Server-Sent Events (SSE) or Fetch Streams to receive PCM/WAV chunks as they generate.
   */
  async *streamMusicGeneration(
    params: LyriaGenerationParams,
    signal?: AbortSignal
  ): AsyncGenerator<Uint8Array, GeneratedAudioTrack, unknown> {
    const traceparent = createTraceparent();

    const response = await fetch(`${this.gatewayUrl}/api/v1/lyria/generate-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        traceparent,
      },
      body: JSON.stringify(params),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorPayload = (await response.json().catch(() => ({}))) as Partial<ProblemDetail> & {
        error?: string;
      };
      const retryAfter = response.headers.get('Retry-After') || errorPayload.retryAfterSeconds;
      const detailMessage =
        errorPayload.detail ||
        errorPayload.error ||
        errorPayload.title ||
        `Lyria generation failed (HTTP ${response.status})`;

      throw new Error(
        retryAfter ? `${detailMessage} (Retry after ${retryAfter}s)` : detailMessage
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pendingMetadataBuffer: Uint8Array | null = null;
    let carryOverBuffer: Uint8Array = new Uint8Array(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        // Accumulate metadata if header was already found
        if (pendingMetadataBuffer) {
          pendingMetadataBuffer = this.concatBuffers(pendingMetadataBuffer, value);
          continue;
        }

        // Merge leftover bytes from the end of the previous chunk to catch split .MET headers
        const chunkToProcess =
          carryOverBuffer.length > 0 ? this.concatBuffers(carryOverBuffer, value) : value;

        const metIndex = this.findMetadataHeaderIndex(chunkToProcess);

        if (metIndex !== -1) {
          // Yield audio preceding .MET (subtracting carryOver offset)
          if (metIndex > 0) {
            yield chunkToProcess.slice(0, metIndex);
          }
          pendingMetadataBuffer = chunkToProcess.slice(metIndex + 4);
          carryOverBuffer = new Uint8Array(0);
        // Retain last 3 bytes in carryOverBuffer in case .MET is split into the next chunk
        } else if (chunkToProcess.length >= 3) {
          const yieldableLength = chunkToProcess.length - 3;
          if (yieldableLength > 0) {
            yield chunkToProcess.slice(0, yieldableLength);
          }
          carryOverBuffer = chunkToProcess.slice(yieldableLength);
        } else {
          carryOverBuffer = chunkToProcess;
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Flush any leftover bytes in carryOverBuffer if stream ended without metadata
    if (!pendingMetadataBuffer && carryOverBuffer.length > 0) {
      yield carryOverBuffer;
    }

    if (!pendingMetadataBuffer || pendingMetadataBuffer.length === 0) {
      throw new Error('Stream completed without returning .MET track metadata.');
    }

    // Parse accumulated metadata at stream end
    let trackMetadata: GeneratedAudioTrack;
    try {
      const jsonString = decoder.decode(pendingMetadataBuffer);
      trackMetadata = JSON.parse(jsonString) as GeneratedAudioTrack;
    } catch {
      throw new Error('Failed to parse track metadata JSON from stream end.');
    }

    // Detect mid-stream safety or upstream errors written into the closing .MET frame
    if (trackMetadata.status === 'FAILED' || trackMetadata.error) {
      throw new Error(trackMetadata.error || 'Audio generation failed mid-stream.');
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
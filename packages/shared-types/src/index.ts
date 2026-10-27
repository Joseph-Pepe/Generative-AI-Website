// To maintain loose coupling between MFEs, we need to create a strict type contract for inter-application messaging.
export type StemName = 'vocals' | 'drums' | 'bass' | 'other';

export interface StemUrls {
  vocalsUrl?: string;
  drumsUrl?: string;
  bassUrl?: string;
  otherUrl?: string;
}

export interface GeneratedAudioTrack {
  id: string;
  title: string;
  prompt: string;
  genre: string;
  mood: string;
  bpm: number;
  durationSeconds?: number;
  audioUrl?: string;
  status?: 'STREAMING' | 'SUCCESS' | 'COMPLETED' | 'DEMIXING' | 'DEMIXED' | 'FAILED';
  error?: string;
  stems?: StemUrls;
  createdAt?: string;
}

/**
 * Standardized RFC 9457 ProblemDetail error contract returned by both the
 * Java 25 Spring Boot 4 Gateway and the Node.js 24 Backend Gateway.
 */
export interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  timestamp?: string;
  traceparent?: string;
  retryAfterSeconds?: number;
}

export type MfeEventType =
  | 'LYRIA:GENERATION_STARTED'
  | 'LYRIA:GENERATION_COMPLETED'
  | 'AUDIO:LOAD_INTO_EDITOR'
  | 'DEMIX:START_PROCESSING'
  | 'DEMIX:STEMS_READY'
  | 'RECOMMENDATION:APPLY_PROMPT';

export interface MfeEventPayloads {
  'LYRIA:GENERATION_STARTED': {
    prompt: string;
    estimatedTime: number;
  };
  'LYRIA:GENERATION_COMPLETED': {
    track: GeneratedAudioTrack;
  };
  'AUDIO:LOAD_INTO_EDITOR': {
    track: GeneratedAudioTrack;
    autoDemix: boolean;
  };
  'DEMIX:START_PROCESSING': {
    trackId: string;
  };
  'DEMIX:STEMS_READY': {
    trackId: string;
    stems: StemUrls;
  };
  'RECOMMENDATION:APPLY_PROMPT': {
    prompt: string;
    genre: string;
    mood: string;
  };
}

/**
 * Generates a W3C Trace Context (traceparent) header in the browser using Web Crypto API
 * so frontend fetch calls correlate directly with backend OpenTelemetry / Zipkin spans.
 */
export function createTraceparent(): string {
  const bytes = new Uint8Array(24);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 24; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let hex = '';
  for (let i = 0; i < 24; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return `00-${hex.slice(0, 32)}-${hex.slice(32, 48)}-01`;
}
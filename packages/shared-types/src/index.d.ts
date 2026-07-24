export interface GeneratedAudioTrack {
    id: string;
    title: string;
    prompt: string;
    genre: string;
    mood: string;
    bpm: number;
    durationSeconds: number;
    audioUrl: string;
    stems?: {
        vocalsUrl?: string;
        drumsUrl?: string;
        bassUrl?: string;
        otherUrl?: string;
    };
    createdAt: string;
}
export type MfeEventType = 'LYRIA:GENERATION_STARTED' | 'LYRIA:GENERATION_COMPLETED' | 'AUDIO:LOAD_INTO_EDITOR' | 'DEMIX:START_PROCESSING' | 'DEMIX:STEMS_READY' | 'RECOMMENDATION:APPLY_PROMPT';
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
        stems: NonNullable<GeneratedAudioTrack['stems']>;
    };
    'RECOMMENDATION:APPLY_PROMPT': {
        prompt: string;
        genre: string;
        mood: string;
    };
}

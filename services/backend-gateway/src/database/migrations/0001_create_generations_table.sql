CREATE TABLE generations (
    -- Use UUIDs or String IDs to match your frontend 'lyria-1710000000000' format
    id VARCHAR(64) PRIMARY KEY,
    
    -- Future-proofing for authentication/multi-tenancy
    user_id VARCHAR(64) NULL,
    
    -- Prompt & Generative Metadata (Crucial for mfe-recommendations vector matching)
    prompt TEXT NOT NULL,
    genre VARCHAR(50) NULL,
    mood VARCHAR(50) NULL,
    bpm INTEGER DEFAULT 120,
    duration_seconds INTEGER DEFAULT 30,
    
    -- Lifecycle Tracking: 'STREAMING', 'COMPLETED', 'DEMIXING', 'DEMIXED', 'FAILED'
    status VARCHAR(30) NOT NULL DEFAULT 'STREAMING',
    
    -- Asset Locations (CDN / S3 Bucket URLs)
    master_audio_url TEXT NULL,
    
    -- JSONB allows storing flexible stem URLs without creating 4 separate columns
    -- Example: {"vocalsUrl": "https://cdn.../voc.wav", "drumsUrl": "https://cdn.../drums.wav"}
    stems_metadata JSONB NULL,
    
    -- Error logging if Gemini API or Demucs workers fail
    error_message TEXT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user library queries and status polling
CREATE INDEX idx_generations_user_created ON generations(user_id, created_at DESC);
CREATE INDEX idx_generations_status ON generations(status) WHERE status != 'COMPLETED' AND status != 'DEMIXED';
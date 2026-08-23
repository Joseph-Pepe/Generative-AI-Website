// --- This is the main entry point for this node.js application ---

// MUST BE THE ABSOLUTE FIRST IMPORT: Load environment variables BEFORE database initialization
import './env.js';

// The Backend Gateway is built on Node.js 24, utilizing native Fetch API and WebSockets to orchestrate Google Gemini Lyria 3 streaming and background stem separation workloads.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai'; // Google's official SDK.
import { Redis } from 'ioredis'; // 🚀 Added Enterprise Redis Client. Prevents the endpoint from being spammed more than the maximum allowed limit.

// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
import crypto from 'crypto'; // Native secure UUID generation

import { db } from './database/index.js';
import { generations } from './database/schemas/0001_create_schema.js';
import { eq, desc } from 'drizzle-orm';

// Recreate __filename and __dirname for ES Modules: Serve static files (HTML, CSS, JS).
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Initialize the Express application
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '5mb' })); // Middleware to parse incoming JSON requests! Increased payload limit from default 100KB to 5MB.

// Best Practice: Fail fast if API key is missing.
if (!process.env.GOOGLE_GEMINI_API_KEY) {
  console.error("❌ CRITICAL ERROR: GOOGLE_GEMINI_API_KEY is missing in .env.local file");
  process.exit(1); 
}

// Initialize Google Gemini AI Client
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

// ======================================================================================
// DISTRIBUTED SYSTEMS RATE LIMITER (GATEWAY SLIDING WINDOW LOG)
// ======================================================================================
/*
  - Replaces express-rate-limit (in-memory) with a highly scalable Redis cluster backend.
  - Uses an atomic Lua script executed via EVALSHA to guarantee zero race conditions.
  - Fails OPEN if Redis goes down, ensuring the Gateway stays online during an outage.
*/

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

redisClient.on('error', (err) => console.error('❌ Redis connection error:', err.message));
redisClient.on('connect', () => console.log('📦 Successfully connected to Redis cluster'));

// Redis Lua Script: Executes atomic cleanup, count, check, insert, and expire in 1 trip per request (~1-2ms)
const RATE_LIMIT_LUA = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local member = ARGV[4]
  local clearBefore = now - window

  redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
  local currentRequests = redis.call('ZCARD', key)

  if currentRequests >= limit then
      return 0
  end

  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, math.ceil(window / 1000))
  return 1
`;

// Define the command so ioredis caches it on the server and executes via ultra-fast EVALSHA
redisClient.defineCommand('slidingWindowRateLimit', {
  numberOfKeys: 1,
  lua: RATE_LIMIT_LUA,
});

// Augment ioredis TypeScript types
declare module 'ioredis' {
  interface RedisCommander<Context> {
    slidingWindowRateLimit(key: string, now: string, window: string, limit: string, member: string): Promise<number>;
  }
}

// Custom Express Middleware (Prevent spamming Lyria 3 endpoint)
const generateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Limits by IP. If you add Auth later, change this to: const clientIdentity = req.user?.id || req.ip;
    const clientIdentity = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const redisKey = `rate_limit:generate:${clientIdentity}`;
    
    const nowMillis = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 10;  // Limit each IP to 10 requests per window
    
    // Unique member for the ZSET (Score is timestamp, Value is timestamp + fast secure UUID)
    const uniqueMember = `${nowMillis}-${crypto.randomUUID().substring(0, 8)}`;

    const allowed = await redisClient.slidingWindowRateLimit(
      redisKey,
      nowMillis.toString(),
      windowMs.toString(),
      maxRequests.toString(),
      uniqueMember
    );

    if (allowed === 0) {
      console.warn(`[WARN] Rate limit triggered for IP: ${clientIdentity}!`);
      res.status(429).json({ 
        error: 'Too many tracks generated from this IP, please try again after 15 minutes across the cluster.' 
      });
      return; // Halt execution chain
    }

    next();
  } catch (error) {
    // REDIS IS DOWN! Log the error immediately, but FAIL OPEN so the API stays online.
    console.error('🔥 CRITICAL: Redis cluster is unreachable! Bypassing rate limiter safety to keep Gateway online.', error);
    next();
  }
};

// ======================================================================================

// ======================================================================================
// FULL-DUPLEX WEBSOCKET AUDIO GATEWAY
// ======================================================================================
/*  
    - For best performance, send the data as an ArrayBUffer or blob (i.e., raw binary buffers).

    // 1. CONTROL MESSAGE (Sent as Text -> isBinary = false)
    ws.send(JSON.stringify({ 
      event: 'START_RECORDING', 
      sampleRate: 16000 
    }));

    // 2. AUDIO STREAM CHUNK (Sent as Binary -> isBinary = true)
    // audioData is an Int16Array or Float32Array from an AudioWorklet / Web Audio API
    const pcmBuffer = audioData.buffer; 

    // Sends an Opcode 0x2 binary frame directly down the wire
    ws.send(pcmBuffer);
*/
// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('⚡ Client connected to LyriaStudio Real-Time WebSocket Gateway');

  // 1. Handshake: Tell the browser exactly what audio format the server expects
  const handshake = JSON.stringify({ 
    event: 'SERVER_READY', 
    config: { sampleRate: 16000, channels: 1, encoding: 'pcm_16bit' } 
  });
  ws.send(handshake);

  // 2. The Multiplexer: Handle incoming messages based on their data type
  ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
    
    if (isBinary) {
      // --- A. THE RAW BINARY AUDIO PIPELINE (Microphone Input) ---
      // 'data' is a raw Node.js Buffer containing the chunk of microphone PCM data.
      const audioBuffer = data as Buffer;
      
      // LOGIC GOES HERE:
      // 1. Stream this buffer to a background GPU Demucs worker.
      // 2. Stream this buffer into Google's Realtime Voice API.
      
      // FOR TESTING (THE ECHO): 
      // Instantly blast the exact same audio buffer back to the client's speakers. 
      // This proves your full-duplex pipeline is perfectly aligned.
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(audioBuffer, { binary: true });
      }

    } else {
      // --- B. THE CONTROL MESSAGE PIPELINE (JSON Metadata) ---
      try {
        const payload = data.toString('utf8');
        const message = JSON.parse(payload);
        
        switch (message.event) {
          case 'START_RECORDING':
            console.log('🎙️ Client started streaming microphone audio...');
            break;
          case 'STOP_RECORDING':
            console.log('🛑 Client stopped streaming.');
            break;
          case 'UPDATE_BPM':
            console.log(`⏱️ Client changed target BPM to ${message.bpm}`);
            break;
          default:
            console.log('🎛️ Unknown Control Message:', message);
        }
      } catch (err) {
        console.error('❌ Failed to parse WebSocket text payload:', err);
      }
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected from WebSocket Gateway');
  });
  
  ws.on('error', (error) => {
    console.error('💥 WebSocket Error:', error);
  });
});

// Allow both your standalone MFE port and your Host Container port!
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:3001'] 
}));

// ================================
// --- Music Test API Endpoints ---
// ================================

app.get('/api/v1/test', async (_req: Request, res: Response) => {
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// ======================================
// --- Music Generation API Endpoints ---
// ======================================

/**
 * Endpoint: Fetch generation history
 * Returns the 10 most recent tracks
 */
app.get('/api/v1/generations/history', async (_req: Request, res: Response) => {
  try {
    const history = await db.query.generations.findMany({
      orderBy: [desc(generations.createdAt)],
      limit: 10
    });

    res.json(history);
  } catch (error: any) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch generation history' });
  }
});


/**
 * Endpoint: Fetch a generated audio track by ID from PostgreSQL
 */
app.get('/api/v1/generations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Ensure id is treated as a single string
    const trackId = Array.isArray(id) ? id[0] : id;

    if (!trackId) {
      res.status(400).json({ error: 'Track ID is required' });
      return;
    }

    // Option 1:Drizzle database instance with your TypeScript schema loaded.

    // Use this whenever you want to fetch a generated audio track by its ID.
    const track = await db.query.generations.findFirst({
      where: eq(generations.id, trackId  /*req.params.id as string*/),
    });

    if (!track) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }

    res.json(track);
  } catch (error: any) {
    console.error('Database query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🛠️ DEV STRATEGY: Generate a synthetic 44.1kHz mono WAV file in memory and stream it safely!
const generateWave = (req: Request, res: Response) => {
    const { prompt, genre, mood, bpm = 120 } = req.body;
    console.log(`🧪 [Synthetic Memory Mode] Generating and streaming audio for prompt: "${prompt}"`);

    const sampleRate = 44100;
    const durationSeconds = 5; 
    const numSamples = sampleRate * durationSeconds;
    const bytesPerSample = 2; // 16-bit PCM
    const subChunk2Size = numSamples * bytesPerSample;
    const chunkSize = 36 + subChunk2Size;

    // 1. Write the standard 44-byte RIFF/WAV Header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);                      
    header.writeUInt32LE(chunkSize, 4);           
    header.write('WAVE', 8);                      
    header.write('fmt ', 12);                     
    header.writeUInt32LE(16, 16);                 
    header.writeUInt16LE(1, 20);                  
    header.writeUInt16LE(1, 22);                  
    header.writeUInt32LE(sampleRate, 24);         
    header.writeUInt32LE(sampleRate * bytesPerSample, 28); 
    header.writeUInt16LE(bytesPerSample, 32);     
    header.writeUInt16LE(16, 34);                 
    header.write('data', 36);                     
    header.writeUInt32LE(subChunk2Size, 40);      

    res.write(header);

    // 2. Stream mathematical audio chunks cleanly
    const frequency = 440; // A4 Note
    // Send larger chunks (250ms worth of audio every 200ms) to prevent browser buffer underruns
    const chunkSizeInSamples = Math.floor(sampleRate * 0.25); 
    let sampleIndex = 0;

    const interval = setInterval(() => {
      // 🛠️ CRITICAL SAFETY LAYER: If the client dropped or cancelled the request, clear memory and fail safely!
      if (res.writableEnded || res.destroyed) {
        console.log("🛑 [Synthetic Memory Mode] Client disconnected. Clearing execution interval.");
        clearInterval(interval);
        return;
      }

      if (sampleIndex >= numSamples) {
        clearInterval(interval);
        
        const trackId = `mock-synth-${Date.now()}`;
        const metadataPayload = JSON.stringify({ id: trackId, title: prompt, genre, mood, bpm, status: 'SUCCESS' });
        const metHeader = Buffer.from([0x7f, 0x4d, 0x45, 0x54]); // .MET magic bytes
        
        res.write(Buffer.concat([metHeader, Buffer.from(metadataPayload)]));
        res.end();
        return;
      }

      const samplesToWrite = Math.min(chunkSizeInSamples, numSamples - sampleIndex);
      const chunkBuffer = Buffer.alloc(samplesToWrite * bytesPerSample);

      for (let i = 0; i < samplesToWrite; i++) {
        // Continuous time calculation prevents phase popping between packets
        const t = (sampleIndex + i) / sampleRate;

        // Generate pure synth tone with a soft harmonic
        const sampleValue = Math.sin(2 * Math.PI * frequency * t) * 0.5 + 
                            Math.sin(2 * Math.PI * frequency * 1.5 * t) * 0.2;
                            
        const intSample = Math.floor(sampleValue * 32767);
        chunkBuffer.writeInt16LE(intSample, i * bytesPerSample);
      }

      sampleIndex += samplesToWrite;
      res.write(chunkBuffer);
    }, 200); // 200ms tick rate is much kinder to the Node event loop
};

// const accessWave = (req: Request, res: Response) => {
//     const { prompt, genre, mood, bpm = 120 } = req.body;

//     console.log(`🧪 [Mock Mode] Streaming local test audio for prompt: "${prompt}"`);
    
//     // Read a sample WAV file from your local disk and stream it in chunks
//     const samplePath = path.join(__dirname, '../assets/sample_track.wav');
//     const readStream = fs.createReadStream(samplePath, { highWaterMark: 1024 * 64 }); // 64KB chunks

//     readStream.on('data', (chunk) => {
//       res.write(chunk);
//     });

//     readStream.on('end', async () => {
//       const trackId = `mock-${Date.now()}`;
//       const metadataPayload = JSON.stringify({ id: trackId, title: prompt, genre, mood, bpm, status: 'SUCCESS' });
//       const header = Buffer.from([0x7f, 0x4d, 0x45, 0x54]); // .MET
//       res.write(Buffer.concat([header, Buffer.from(metadataPayload)]));
//       res.end();
//     });

//     return;
// };


/**
 * Endpoint: Stream Music Generation via Lyria 3
 * Converts Lyria 3 generative model chunks into a continuous browser-consumable stream.
 */
app.post('/api/v1/lyria/generate-stream', generateLimiter, async (req: Request, res: Response) => {
  const { prompt, genre, mood, bpm = 120, useMock = true } = req.body;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 🛠️ DEV STRATEGY: If billing isn't enabled or useMock is true, stream a local sample!
  if (useMock || process.env.USE_MOCK_AUDIO === 'true') {
    generateWave(req, res);
    return;
  }

  try {
    // Construct rich system prompt for Lyria 3 model
    const enhancedPrompt = `Generate high-fidelity 48kHz stereo studio music. Genre: ${genre}. Mood: ${mood}. BPM: ${bpm}. Description: ${prompt}`;

    console.log(`Sending prompt to Google Gemini API (Lyria 3 Pro): "${prompt}"...`);
    
    // --- Generative AI (Google) ---

    // Call Google Gemini Lyria 3 Model (Streaming Mode)
    const responseStream = await ai.models.generateContentStream({
      model: 'lyria-3-pro-preview', // 'lyria-3-clip-preview' for ~30s clips, 'lyria-3-pro-preview' for ~3min clips.
      contents: [enhancedPrompt], // replace [enhancedPrompt] with prompt.
      config: {
        // responseMimeType: 'audio/wav',
        responseModalities: ['AUDIO', 'TEXT'],
      },
    });

    for await (const chunk of responseStream) {
      // 1. Check for safety blocks
      const candidate = chunk.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`⚠️ Generation blocked. Reason: ${candidate.finishReason}`);
        // Close the stream with an error payload
        res.write(JSON.stringify({ error: `Blocked by safety filters: ${candidate.finishReason}` }));
        res.end();
        return;
      }

      // 2. Otherwise, send the audio buffer
      if (candidate?.content?.parts?.[0]?.inlineData?.data) {
        // Convert Base64 audio chunk from API to raw binary buffer
        const audioBuffer = Buffer.from(candidate.content.parts[0].inlineData.data, 'base64');
        res.write(audioBuffer);
      }
    }

    // 1. Generate a single, unified ID for this track
    const trackId = `lyria-${Date.now()}`;

    // Send closing metadata packet with exact `.MET` magic header
    const metadataPayload = JSON.stringify({ id: trackId, title: prompt, genre, mood, bpm, status: 'SUCCESS' });
    
    const header = Buffer.from([0x7f, 0x4d, 0x45, 0x54]); // .MET
    const metadataBuffer = Buffer.concat([header, Buffer.from(metadataPayload)]);
    res.write(metadataBuffer);
    res.end(); // The frontend now has the full audio file!

    // 3. Save to PostgreSQL using Drizzle ORM in the background
    try {
      await db.insert(generations).values({
        id: trackId,
        prompt: prompt,
        genre: genre,
        mood: mood,
        bpm: bpm,
        status: 'SUCCESS'
      });
      console.log(`✅ Generation [${trackId}] saved to database!`);
    } catch (dbError) {
      console.error('⚠️ Could not save to database, but audio generated:', dbError);
    }

  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`❌ API Error: ${errorMessage}`);

    // Catch Gemini Quota/Billing limits
    if (error.status === 429) {
      res.status(429).json({ error: 'API Quota exceeded. Please check your Google AI Studio billing settings.' });
      return;
    }

    res.status(500).json({ error: 'Failed to generate music due to a server error.' });
  }
});

// =====================================
// --- Music Demixing  API Endpoints ---
// =====================================

/**
 * Endpoint: Mock Demixing Orchestration
 * In production, this pushes to a Redis queue running Hybrid Demucs GPU workers.
 */
app.post('/api/v1/audio/demix', async (req: Request, res: Response) => {
  const { trackId, audioUrl } = req.body;

  // Use the variables in a log to satisfy TypeScript and aid debugging
  console.log(`[Demix Engine] Starting separation for Track ID: ${trackId} (${audioUrl})`);

  // Simulate stem separation processing delay
  await new Promise(resolve => setTimeout(resolve, 4000));

  // Return static/processed stem URLs for the multi-track DAW
  res.json({
    vocalsUrl: 'https://cdn.lyriastudio.ai/stems/sample_vocals.wav',
    drumsUrl: 'https://cdn.lyriastudio.ai/stems/sample_drums.wav',
    bassUrl: 'https://cdn.lyriastudio.ai/stems/sample_bass.wav',
    otherUrl: 'https://cdn.lyriastudio.ai/stems/sample_other.wav',
  });
});

// Catch-all for undefined routes! User goes to a route that does not exist.
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('🔥 Unhandled Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Define the port the server will run on (look for BACKEND_PORT first, fallback to 8000)
const PORT = process.env.BACKEND_PORT || process.env.PORT || 8000;

// Start the server and listen on the specified port
server.listen(PORT, () => {
  console.log(`🚀 LyriaStudio Backend Gateway running on port ${PORT} (Node.js ${process.version})`);
  console.log(`⚡ HTTP Generation API: http://localhost:${PORT}/api/v1/lyria/generate-stream`);
  console.log(`⚡ HTTP History API:   http://localhost:${PORT}/api/v1/generations/history`);
  console.log(`⚡ Test API Endpoint: http://localhost:${PORT}/api/v1/test`);
  console.log(`🔌 WebSocket Gateway:  ws://localhost:${PORT}/ws`);
  console.log(`🌐 Local frontend: http://localhost:${PORT}.`);
});
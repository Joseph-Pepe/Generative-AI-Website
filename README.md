# 🎵 LyriaStudio: AI Music Generator & Real-Time Audio Demixer

[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8.1.5](https://img.shields.io/badge/Vite-8.1.5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0.0-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express 5](https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Google AI Studio](https://img.shields.io/badge/Google%20AI-Lyria%203-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![WebAudio API](https://img.shields.io/badge/Web%20Audio-API-FF6F00?logo=webaudio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Module Federation](https://img.shields.io/badge/Module%20Federation-Enabled-blueviolet)](https://module-federation.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)

**LyriaStudio** is a next-generation, browser-based **Digital Audio Workstation (DAW)** and AI music production platform built on a **Micro Frontend (MFE) Architecture** using **React 19.2**, **Node.js 24**, **pnpm 11** and **Vite 8**. Powered by **Google Gemini Lyria 3**, it enables artists, producers, and creators to generate high-fidelity (studio-quality) music from text prompts, receive intelligent genre/mood suggestions, demix audio into multi-track stems in real time, and edit compositions with professional-grade web audio processing, backed by a hardened **Node.js 24 BFF Gateway** featuring **Valkey 8 / Redis Lua rate limiting with a Circuit-Broken Local Fallback**, **RFC 9457 (`ProblemDetail`)** error contracts, **W3C `traceparent`** distributed tracing, and **zero-downtime graceful shutdown**..

<img width="1920" height="935" alt="image" src="https://github.com/user-attachments/assets/bf0f69b7-cfa5-4cf1-8dc0-fbb48d91c30f" />


---

## ✨ Key Features

1. **🧠 Generative Audio with Google Gemini (Lyria 3)**
   - Turn simple text prompts into high-fidelity, fully mastered musical tracks.
   - Support for low-latency streaming audio decoding—listen while the track generates.
   - Fine-grained parameter control: tempo (BPM), key signature, instrumentation weight, and structural progression.

2. **💡 Personalized Recommendation Engine**
   - Learns user preferences over time (favorite moods, genres, acoustic profiles).
   - Smart Prompt Enrichment: Automatically transforms basic ideas into rich, technically descriptive Lyria 3 prompts.
   - Interactive mood boards and genre preset selector.

3. **🎛️ Real-Time Non-Destructive Audio Editor**
   - **Multi-track Timeline:** Zoom, slice, trim, and loop audio segments with sample-level precision.
   - **DSP Effects Rack:** Real-time Web Audio API parametric EQ, algorithmic reverb, tape delay, and multiband compression.
   - **Automation Curves:** Draw volume and filter automations directly onto the waveform canvas.

4. **🪓 AI Audio Demixing (Stem Separation)**
   - Separate any generated or imported track into **4 distinct stems**: Vocals, Drums, Bass, and Other Instruments.
   - Powered by in-browser **ONNX Runtime Web** (WebGPU/WASM accelerated) for zero-latency local processing, with optional cloud inference fallback.
   - Individual stem control: Mute, Solo, Pan, and Level adjustment.

5. 🛡️ Enterprise Node.js 24 Gateway, Circuit-Broken Rate Limiting & RFC 9457 Resiliency (`services/backend-gateway`)
  - **Two-Tier Rate Limiter (Valkey 8 Lua Primary + Circuit-Broken Local Fallback):** Executes an atomic sliding-window Lua script via cached `EVALSHA` and millisecond-precise `PEXPIRE` with a `250ms` fail-fast `commandTimeout` and `enableOfflineQueue: false`. If Valkey/Redis fails `5` consecutive times, an in-memory Circuit Breaker opens for `15s`, bypassing dead sockets in `~0.05ms` and enforcing a bounded local sliding window (capped at `10,000` users to prevent `OutOfMemory` leaks) while emitting `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers.
  - **RFC 9457 (`ProblemDetail`) & Mid-Stream Crash Protection:** Standardized `application/problem+json` error responses (`type`, `title`, `status`, `detail`, `instance`, `timestamp`, `traceparent`). During chunked binary audio streaming (`/api/v1/lyria/generate-stream`), guards against `ERR_HTTP_HEADERS_SENT` crashes by checking `!res.headersSent` before emitting HTTP errors, or appending a closing `.MET` error frame if headers were already flushed.
  - **Zero-Trust Perimeter & W3C Distributed Tracing:** Trusts upstream cloud load balancers (`trust proxy`), strips spoofed `x-gateway-validated` headers, sets `Strict-Transport-Security` (HSTS), `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`, and propagates incoming W3C `traceparent` headers (or generates a fresh trace ID) across every HTTP response.
  - **Hardened WebSockets & Connection Pools:** Caps WebSocket binary frames at `1MB` (`maxPayload`), runs a `30s` Ping/Pong heartbeat sweeper to terminate zombie sockets, and tunes the PostgreSQL `pg.Pool` (`max: 20`, `connectionTimeoutMillis: 3000`, `maxUses: 7500`) with immediate startup `client.release()`.
  - **Zero-Downtime Graceful Shutdown (`SIGTERM` / `SIGINT`):** Intercepts container termination signals, closes active WebSocket sessions with code `1001`, drains in-flight HTTP streams, and cleanly closes Valkey and PostgreSQL pools within a `15s` deadline.
---

## 🏗️ Micro Frontend Architecture

The application uses a Distributed Module Federation model powered by Vite 8. Each Micro Frontend can be developed, tested, and deployed independently while sharing zero-copy Web Audio API contexts and synchronization primitives in the browser.

```text
+-----------------------------------------------------------------------------------+
|                                  BROWSER RUNTIME                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                           HOST (Container)                                  |  |
|  |  [Router / Auth / Layout / Shared AudioContext / Event Bus / Global State]  |  |
|  +-----------------------------------------------------------------------------+  |
|          |                         |                           |                  |
|          | Module Federation       | Module Federation         | Shared WebAudio  |
|          v                         v                           v                  |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|  |     mfe-generator     |  |      mfe-editor       |  |  mfe-recommendations  |  |
|  |  (AI Prompt & Lyria)  |  |  (DAW / Demix / DAW)  |  | (Mood/Genre Engine)   |  |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|          |                         |                           |                  |
+----------|-------------------------|---------------------------|------------------+
           | REST / SSE / WebSockets | Audio Streaming / ONNX    | GraphQL / gRPC
           v                         v                           v
+-----------------------------------------------------------------------------------+
|              NODE.JS 24 AUDIO GATEWAY & BFF (Port 8000 • Non-Root)                |
|  • Zero-Trust Headers (HSTS/nosniff/DENY) + W3C traceparent Context Propagation   |
|  • RFC 9457 ProblemDetail Contracts + Safe Mid-Stream (.MET) Error Recovery       |
|  • WebSocket Multiplexer (1MB Payload Cap + 30s Ping/Pong Zombie Eviction)        |
|  • 15s Graceful Shutdown Drain (SIGTERM/SIGINT across HTTP, WS, Valkey & PG Pool) |
|                                                                                   |
|  +-------------------+   +--------------------+   +----------------------------+  |
|  | Gemini Lyria 3    |   | Demixing Engine    |   | Recommendation Vector DB   |  |
|  | Orchestrator      |   | (Demucs / WASM     |   | (User Interest Profiling   |  |
|  | (Audio Streaming) |   |  / Worker Threads) |   |  & Prompt Optimization)    |  |
|  +-------------------+   +--------------------+   +----------------------------+  |
|  +------------------------------------+   +------------------------------------+  |
|  | PostgreSQL 15+ (Drizzle ORM Pool)  |   | Valkey 8 / Redis 8 (250ms Timeout) |  |
|  | • Max 20 Conn / 3s Connect Timeout |   | • Primary: Cached EVALSHA + PEXPIRE|  |
|  | • Composite & Partial Status Index |   | • Fallback: Circuit-Broken 10k RAM |  |
|  +------------------------------------+   +------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### Monorepo File Structure

This workspace is organized as a unified pnpm monorepo utilizing strict workspace symlinking and shared compiler base configurations:

```text
lyria-studio/
├── .env.local                             # Global environment variables (API keys, ports)
├── package.json                           # Root scripts (dev, build, typecheck, clean)
├── pnpm-workspace.yaml                    # Workspace declarations ('apps/*', 'packages/*', 'services/*')
├── tsconfig.base.json                     # Shared ESNext/Bundler TypeScript configuration
│
├── apps/                                  # Frontend Micro Frontends (Vite 8 + React 19)
│   ├── host-container/                    # [Port 3000] App Shell & Global Web Audio Provider
│   │   ├── src/providers/AudioProvider.tsx# Master Web Audio API context hardware unlocker
│   │   └── vite.config.ts                 # Module Federation Host configuration
│   ├── mfe-audio-generator/               # [Port 3001] Text-to-Music Prompt Studio & Streamer
│   │   ├── src/components/GeneratorStudio.tsx # React 19 useActionState form engine
│   │   └── src/services/lyriaClient.ts    # SSE/WAV binary stream consumer
│   ├── mfe-audio-editor/                  # [Port 3003] Multi-track DAW & AI Stem Demixer
│   │   ├── public/worklets/               # Real-time AudioWorklet processors (EQ/Reverb)
│   │   └── src/components/DemixingWorkstation.tsx # 4-channel stem mixer UI
│   └── mfe-recommendations/               # [Port 3002] Contextual Genre & Mood Discovery Engine
│
├── packages/                              # Shared Internal Libraries (Zero-copy boundaries)
│   ├── shared-types/                      # TypeScript domain models (GeneratedAudioTrack, Stems)
│   ├── event-bus/                         # Type-safe CustomEvent pub/sub communication bridge
│   └── ui-library/                        # Standardized Tailwind CSS audio controls & sliders
│
└── services/                              # Backend Microservices
    └── backend-gateway/                   # [Port 8000] Node.js 24 API Gateway & BFF
        ├── src/controllers/               # Lyria 3 streaming & HT-Demucs separation logic
        ├── src/database/                  # Drizzle ORM Postgres schemas and connection logic
        └── src/server.ts                  # Express + WebSocket real-time HTTP server
```

`Network Layer (services/lyriaClient.ts): ` 

Handles raw HTTP streams, TCP byte boundaries, and .MET custom header parsing without any UI dependencies.

`State Layer (hooks/useLyriaGenerator.ts):` 

Manages the asynchronous streaming lifecycle, audio blob assembly, and React reactivity.

`Presentation & Integration Layer (components/GeneratorStudio.tsx): ` 

Provides the visual DAW interface, displays real-time streaming feedback (receivedBytes / 1024 KB), and acts as the bridge to the rest of your monorepo via @lyria-studio/event-bus.

---

## 📋 System Prerequisites

Before setting up the project locally, verify that your development environment meets the strict modern hardware and runtime requirements for real-time web audio processing:

- **Node.js:** `v24.0.0` or higher (Required for WebAssembly SIMD optimizations and native fetch streams).
- **Package Manager:** `pnpm v11.15.1+` via Corepack (`corepack enable`). Root `pnpm.overrides` automatically locks all Micro Frontends to a single singleton `react@^19.2.8` and `react-dom@^19.2.8` runtime.
- **Databases:** PostgreSQL (`v15+`) and a **Valkey 8 / Redis 8** cluster running on port `6379`.

Google Cloud / AI Studio: An active API key with access to the Gemini Lyria 3 generative audio model (models/lyria-3-pro-preview).

Browser Runtime: Google Chrome 120+, Microsoft Edge 120+, or Firefox Nightly with WebAudio API, SharedArrayBuffer, and WebGPU/WASM flags enabled for local stem demixing.

---

## 🛠️ Compilation Commands
All build and verification tasks can be executed globally from the workspace root or scoped to individual applications using pnpm filters.

**0. Database Migrations**

Push the Drizzle ORM schema to your connected PostgreSQL database before starting the backend:

``terminal
pnpm --filter backend-gateway run db:push
``

**1. Install Workspace Dependencies**

Install all physical packages and generate the strict .pnpm virtual symlink store:

```terminal
pnpm install
```

(Note: If prompted with ERR_PNPM_IGNORED_BUILDS for native binary packages like @google/genai or protobufjs, authorize them by running pnpm approve-builds).

**2. Global Type Checking**

Verify zero TypeScript compilation errors across all micro-frontends, shared contracts, and the backend gateway simultaneously:

```terminal
pnpm -r exec tsc --noEmit
```

**3. Build for Production**

Compile all federated modules into optimized, tree-shaked ES bundles and build the Node.js backend:

```terminal
# Build the entire monorepo in parallel
pnpm build

# Or build a specific micro-frontend individually
pnpm --filter mfe-audio-editor run build
```

**4. Start the Complete Ecosystem (All Workspaces)**

```terminal
pnpm dev --force
```

---

## 🚀 Running the Application

**1. Environment Configuration**

Go into .env.local file in the workspace root (lyria-studio/.env.local) and configure your database and Google API credentials:

```text
GOOGLE_GEMINI_API_KEY="Gemini_Lyria_API_Key"
...
...
REDIS_URL="redis://localhost:6379"
DATABASE_URL="postgresql://db_user:db_password@localhost:5432/database_name"
```

**2. Start the Development Environment**

Launch the Node.js 24 backend gateway alongside all frontend development servers in parallel. Vite will automatically map the Module Federation boundaries:

```text
pnpm dev
```

Once the terminal confirms all services are bound, access the applications via the following local endpoints:

| Service / MFE | Local Address | Role |
| :-- | :-- | :-- |
| host-container | http://localhost:3000 | Main Entry Point: Open this in your browser to use the full DAW. | 
| mfe-audio-generator | http://localhost:3001 | Standalone Lyria 3 prompt interface and stream visualizer. |
| mfe-recommendations | http://localhost:3002 | Standalone genre discovery and prompt enrichment widget. |
| mfe-audio-editor | http://localhost:3003 | Standalone 4-track DAW, stem mixer, and DSP effects rack. | 
| backend-gateway | http://localhost:8000 | Audio stream transcoding, AI orchestration, and WebSocket server. |

**3. Running Production Previews**

To test the compiled production bundles locally with active Module Federation network routing:

```text
# Step 1: Ensure all packages are built and ready to run
pnpm build

# Step 2: Serve the static production builds
pnpm preview
```

---

## 🚀 Test & Run Docker Container (Multi-Stage Non-Root `pnpm deploy`)

The production `Dockerfile` uses `corepack` and `pnpm --filter backend-gateway --prod deploy` to isolate only production dependencies, executes under an unprivileged `node:node` user with `--max-old-space-size=1536`, and includes a native container `HEALTHCHECK` against `/health/readiness`.

Run these two commands to build and launch your containerized DAW:

```text
# 1. Build the multi-stage production Docker image from the root workspace
docker build -t lyria-studio:latest .

# 2. Run the hardened non-root container and expose port 8000
docker run -p 8000:8000 --env-file .env.local lyria-studio:latest

# 3. Verify the Cloud Readiness Probe & W3C Traceparent Header
curl -i http://localhost:8000/health/readiness

# 4. Verify RFC 9457 ProblemDetail (application/problem+json) Error Contract
curl -i http://localhost:8000/api/v1/non-existent-route
```
# 🎵 LyriaStudio: AI Music Generator & Real-Time Audio Demixer

[![React 19.2](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24_LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Vite 8.1.5](https://img.shields.io/badge/Vite-8.1.5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.3.3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express 5](https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Google AI Studio](https://img.shields.io/badge/Google%20AI-Lyria%203-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![WebAudio API](https://img.shields.io/badge/Web%20Audio-API-FF6F00?logo=webaudio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Module Federation](https://img.shields.io/badge/Module%20Federation-2.0-blueviolet)](https://module-federation.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Valkey 8 / Redis 8](https://img.shields.io/badge/Valkey_8_/_Redis-8-DC382D?logo=redis&logoColor=white)](https://valkey.io/)

**LyriaStudio** is a next-generation, browser-based **Digital Audio Workstation (DAW)** and AI music production platform built on a **Micro Frontend (MFE) Architecture** using **React 19.2**, **Node.js 24**, **pnpm 11**, and **Vite 8**. Powered by **Google Gemini Lyria 3**, it enables artists, producers, and creators to generate high-fidelity (studio-quality) music from text prompts, receive intelligent genre/mood suggestions, demix audio into multi-track stems in real time, and edit compositions with professional-grade web audio processing—backed by a hardened **Node.js 24 BFF Gateway** featuring **Valkey 8 / Redis Lua rate limiting with a Circuit-Broken Local Fallback**, **RFC 9457 (`ProblemDetail`)** error contracts, **W3C `traceparent`** distributed tracing, and **zero-downtime graceful shutdown**.

<img width="1920" height="935" alt="image" src="https://github.com/user-attachments/assets/bf0f69b7-cfa5-4cf1-8dc0-fbb48d91c30f" />


---

## ✨ Key Features

1. **🧠 Generative Audio with Google Gemini (Lyria 3) (`apps/mfe-audio-generator`)**
   - Turn text prompts into studio-quality musical tracks with real-time chunked binary streaming (`ReadableStreamDefaultReader`) and split-packet `.MET` trailer assembly.
   - **Abortable Streams & Zero-Leak Memory Lifecycle:** Supports instant in-flight stream cancellation via `AbortController` (`🛑 Stop`) and automatically revokes prior Blob URLs (`URL.revokeObjectURL()`) on regeneration and unmount to prevent 35MB+ WAV buffer leaks.
  - **End-to-End W3C Tracing & RFC 9457 Parsing:** Generates cryptographic W3C `traceparent` headers (`createTraceparent()`) in the browser and parses backend **RFC 9457 `ProblemDetail`** errors and `Retry-After` quotas.

2. **💡 Personalized Recommendation Engine (`apps/mfe-recommendations`)**
   - Learns user preferences over time (favorite moods, genres, acoustic profiles).
  - **Cross-MFE Prompt Enrichment:** Broadcasts `RECOMMENDATION:APPLY_PROMPT` events across the `globalThis` EventBus to populate `GeneratorStudio` without prop-drilling or tight coupling.

3. **🎛️ Real-Time Non-Destructive Audio Editor & Master Limiter (`apps/host-container` + `apps/mfe-audio-editor`)**
   - **Hardware Master Brickwall Limiter (`AudioProvider.tsx`):** Initializes a shared 48kHz interactive `AudioContext` routed through a master `DynamicsCompressorNode` (`-1.0dB` threshold, `20:1` ratio, `3ms` attack) to prevent digital clipping when summing multiple stems.
   - **Offline Master WAV Export (`OfflineAudioContext`):** Renders non-realtime master mixes respecting active Mute, Solo, Gain, and Stereo Pan states into a downloadable 44-byte RIFF/WAVE 16-bit PCM `.wav` file.
4. **🪓 AI Audio Demixing & DAW Mixer Matrix (`DemixingWorkstation.tsx` + `AudioEngine.ts`)**
   - Separates generated or imported tracks into 4 stems (**Vocals**, **Drums**, **Bass**, and **Other Instruments**) with automatic Web Audio node graph teardown on track reload.
  - **Full DAW Mute/Solo Matrix:** Real-time exponential gain smoothing (`setTargetAtTime`) with true Solo isolation (soloing one or more stems automatically silences non-soloed channels) and Stereo Panner (`StereoPannerNode`) control.
  - Powered by in-browser **ONNX Runtime Web** (WebGPU/WASM accelerated) for zero-latency local processing, with optional cloud inference fallback.

5. **🛡️ Enterprise Node.js 24 Gateway, Circuit-Broken Rate Limiting & RFC 9457 Resiliency (`services/backend-gateway`)**
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
|                     BROWSER RUNTIME (React 19.2 • Vite 8 MFE)                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                        HOST CONTAINER (Port 3000)                           |  |
|  |  • Shared 48kHz AudioProvider + Master Brickwall Limiter (-1.0dB / 20:1)    |  |
|  |  • MfeErrorBoundary (Fault Isolation & Retry) + React.lazy Suspense         |  |
|  |  • globalThis Singleton EventBus (Object.freeze Zero-Copy CustomEvents)     |  |
|  +-----------------------------------------------------------------------------+  |
|          |                         |                           |                  |
|          | Module Federation       | Module Federation         | Shared WebAudio  |
|          v                         v                           v                  |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|  | mfe-audio-generator   |  |   mfe-audio-editor    |  |  mfe-recommendations  |  |
|  | • Abortable Streamer  |  | • Mute/Solo/Pan Matrix|  | • Mood/Genre Presets  |  |
|  | • W3C traceparent     |  | • Offline WAV Exporter|  | • Prompt Enrichment   |  |
|  | • Zero-Leak Blob URLs |  | • WebAudio Node GC    |  |   Event Emitter       |  |
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

**Shared Contracts & Zero-Copy Event Bus (`packages/shared-types` & `packages/event-bus`):**

Anchors a single `GlobalEventBus` instance onto `globalThis.__LYRIA_STUDIO_EVENT_BUS__` so all federated remotes share the exact same `EventTarget`, freezing payloads with `Object.freeze()` to prevent cross-MFE mutation. Exports `ProblemDetail` (RFC 9457) and `createTraceparent()` (Web Crypto W3C trace generator).

**Network Application Layer (`apps/mfe-audio-generator/src/services/lyriaClient.ts`):**

Handles chunked binary HTTP streams, split-packet `.MET` magic-byte (`0x7f 0x4d 0x45 0x54`) boundary detection, `AbortSignal` stream cancellation, W3C `traceparent` header injection, `reader.releaseLock()` cleanup, and RFC 9457 `ProblemDetail` + `Retry-After` error extraction.

**State & Memory Lifecycle Layer (`apps/mfe-audio-generator/src/hooks/useLyriaGenerator.ts`):**

Manages the asynchronous streaming lifecycle, exposes `cancelGeneration()` via `AbortController`, prevents browser memory leaks by revoking previous Blob URLs (`URL.revokeObjectURL()`) on every new generation and unmount, and broadcasts `LYRIA:GENERATION_COMPLETED`.

**Presentation & Fault Isolated Container Layer (`GeneratorStudio.tsx`, `DemixingWorkstation.tsx`, `App.tsx`):**

Wraps remote micro-frontends inside `<MfeErrorBoundary>` with one-click retry recovery, renders live byte-counter streaming feedback and RFC 9457 error banners, listens for `RECOMMENDATION:APPLY_PROMPT` events, and drives the 4-stem DAW mixer with real-time Mute/Solo/Volume controls and 16-bit PCM WAV export.

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

```terminal
pnpm --filter backend-gateway run db:push
```

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

**5. Run the Automated Node.js 24 Verification Suite**

```terminal
pnpm --filter backend-gateway test
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

## 🧪 Automated Integration & Chaos Testing Suite (`node:test`)

LyriaStudio includes a zero-dependency, 6-stage automated integration and chaos test harness (`services/backend-gateway/test/gateway.test.ts`) powered by **Node.js 24's native test runner (`node:test`)**, strict assertions (`node:assert/strict`), and `tsx`.

During test execution (`NODE_ENV=test`), the Express and WebSocket gateway binds to an ephemeral OS port (`127.0.0.1:0`) for isolated, parallelizable verification across shared monorepo packages and backend endpoints—and automatically closes all active HTTP sockets, WebSocket heartbeats, Valkey/Redis clients, and PostgreSQL connection pools upon completion.

### Run the Test Suite

```bash
# Run from the monorepo workspace root
pnpm --filter backend-gateway test

# Or run all workspace test scripts across the monorepo
pnpm test
```

### 6 Verification Stages Covered

1. **W3C `createTraceparent()` Cryptographic Generator (`@lyria-studio/shared-types`):**
   Generates 1,000 rapid W3C Trace Context headers (`00-<32-hex-trace-id>-<16-hex-span-id>-01`), asserting strict specification compliance and zero entropy collisions.
2. **Global EventBus Singleton & Payload Immutability (`@lyria-studio/event-bus`):**
   Verifies that `eventBus` is anchored to `globalThis.__LYRIA_STUDIO_EVENT_BUS__` across Module Federation boundaries, delivers strongly-typed `RECOMMENDATION:APPLY_PROMPT` payloads, enforces `Object.freeze()` to block rogue cross-MFE state mutation (`TypeError`), and detaches listeners cleanly on unsubscribe.
3. **Zero-Trust Security Headers & W3C Trace Propagation (`GET /health/readiness`):**
   Verifies that the gateway strips spoofed `X-Gateway-Validated` headers, enforces `Strict-Transport-Security` (HSTS), `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`, and echoes incoming W3C `traceparent` headers.
4. **RFC 9457 `ProblemDetail` Error Contracts (`404 Not Found` & `400 Bad Request`):**
   Proves that unmapped routes and invalid requests return standardized `application/problem+json` payloads containing `title`, `status`, `detail`, `instance`, `timestamp`, and `traceparent`.
5. **Chunked Binary WAV Streaming & `.MET` Magic Trailer Framing (`POST /api/v1/lyria/generate-stream`):**
   Streams synthetic 44.1kHz 16-bit PCM audio, verifying the 44-byte `RIFF`/`WAVE` binary header (`0x52 0x49 0x46 0x46`) at byte `0` and extracting the closing `.MET` magic-byte (`0x7f 0x4d 0x45 0x54`) JSON metadata trailer at stream end.
6. **Two-Tier Distributed Rate Limiter & Circuit-Broken Local Fallback (`HTTP 429`):**
   Fires 10 rapid requests from a simulated client IP (`X-Forwarded-For: 203.0.113.99`) and proves that the 11th request is rejected with `429 Too Many Requests`, `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining: 0`, `Retry-After: 900`, and an RFC 9457 `ProblemDetail` body—even if the Valkey/Redis cluster is offline and operating on the bounded in-memory local fallback.


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
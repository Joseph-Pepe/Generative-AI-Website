# 🎵 LyriaStudio: AI Music Generator & Real-Time Audio Demixer

[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8.1.5](https://img.shields.io/badge/Vite-8.1.5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gemini Lyria 3](https://img.shields.io/badge/Google%20AI-Lyria%203-4285F4?logo=google&logoColor=white)](https://deepmind.google/technologies/lyria/)
[![WebAudio API](https://img.shields.io/badge/Web%20Audio-API-FF6F00?logo=webaudio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Module Federation](https://img.shields.io/badge/Module%20Federation-Enabled-blueviolet)](https://module-federation.io/)

**LyriaStudio** is a next-generation, browser-based **Digital Audio Workstation (DAW)** and AI music production platform built on a **Micro Frontend (MFE) Architecture** using **React 19**, **Node.js 24**, **pnpm 11** and **Vite 8**. Powered by **Google Gemini Lyria 3**, it enables artists, producers, and creators to generate high-fidelity (studio-quality) music from text prompts, receive intelligent genre/mood suggestions, demix audio into multi-track stems in real time, and edit compositions with professional-grade web audio processing.

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
|                         NODE.JS 24 AUDIO GATEWAY & BFF                            |
|                                                                                   |
|  +-------------------+   +--------------------+   +----------------------------+  |
|  | Gemini Lyria 3    |   | Demixing Engine    |   | Recommendation Vector DB   |  |
|  | Orchestrator      |   | (Demucs / WASM     |   | (User Interest Profiling   |  |
|  | (Audio Streaming) |   |  / Worker Threads) |   |  & Prompt Optimization)    |  |
|  +-------------------+   +--------------------+   +----------------------------+  |
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
        └── src/server.ts                  # Express + WebSocket real-time HTTP server
```

`Network Layer (services/lyriaClient.ts): ` Handles raw HTTP streams, TCP byte boundaries, and .MET custom header parsing without any UI dependencies.

`State Layer (hooks/useLyriaGenerator.ts):` Manages the asynchronous streaming lifecycle, audio blob assembly, and React reactivity.

`Presentation & Integration Layer (components/GeneratorStudio.tsx): ` Provides the visual DAW interface, displays real-time streaming feedback (receivedBytes / 1024 KB), and acts as the bridge to the rest of your monorepo via @lyria-studio/event-bus.

---

## 📋 System Prerequisites
Before setting up the project locally, verify that your development environment meets the strict modern hardware and runtime requirements for real-time web audio processing:

Node.js: v24.0.0 or higher (Required for experimental WebAssembly SIMD optimizations and native fetch streams).

Package Manager: pnpm v10.0.0 or higher (Corepack enabled recommended: corepack enable pnpm).

Google Cloud / AI Studio: An active API key with access to the Gemini Lyria 3 generative audio model (models/lyria-3-pro-streaming).

Browser Runtime: Google Chrome 120+, Microsoft Edge 120+, or Firefox Nightly with WebAudio API, SharedArrayBuffer, and WebGPU/WASM flags enabled for local stem demixing.

---

## 🛠️ Compilation Commands
All build and verification tasks can be executed globally from the workspace root or scoped to individual applications using pnpm filters.

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

**4. Clean Workspace Cache**

Purge all compiled artifacts, Vite bundler caches, and temporary build files:

```terminal
pnpm clean
```

---

## 🚀 Running the Application

**1. Environment Configuration**

Go into .env.local file in the workspace root (lyria-studio/.env.local) and configure your API credentials:

```text
GOOGLE_GEMINI_API_KEY=ai-zaSy...your-gemini-lyria-key-here...
LYRIA_MODEL_VERSION=models/lyria-3-pro-streaming
...
...
```

**2. Start the Development Environment**

Launch the Node.js 24 backend gateway alongside all frontend development servers in parallel. Vite will automatically map the Module Federation boundaries:

```text
pnpm dev
```

Once the terminal confirms all services are bound, access the applications via the following local endpoints:

| Service / MFE | Local Address | Role |
| :-- | :-- | :-- |
| host-contaier | http://localhost:3000 | Main Entry Point: Open this in your browser to use the full DAW. | 
| mfe-audio-generator | http://localhost:3001 | Standalone Lyria 3 prompt interface and stream visualizer. |
| mfe-recommendations | http://localhost:3002 | Standalone genre discovery and prompt enrichment widget. |
| mfe-audio-editor | http://localhost:3003 | Standalone 4-track DAW, stem mixer, and DSP effects rack. | 
| backend-gateway | http://localhost:8000 | Audio stream transcoding, AI orchestration, and WebSocket server. |

**3. Running Production Previews**

To test the compiled production bundles locally with active Module Federation network routing:

```text
# Step 1: Ensure all packages are built
pnpm build

# Step 2: Serve the static production builds
pnpm preview
```

---

## 🚀 Test & Run Docker Container

Run these two commands to build and launch your containerized DAW:

```text
# 1. Build the Docker image from the root workspace
docker build -t lyria-studio:latest .

# 2. Run the container and expose port 8000
docker run -p 8000:8000 --env-file .env.local lyria-studio:latest
```

---
<b>AI Integration (Google Gemini)</b>
---

`Step #1:` Go to google AI Studio to get a key to use for the APIs in your application.

<img width="1722" height="832" alt="image" src="https://github.com/user-attachments/assets/5d5f41a6-3a81-41c8-984b-422417752ffa" />

`Step #2:` Create an `.env` file in the root folder of your project that contains the API key.

```text
GEMINI_API_KEY=actual_api_key
```

`Step #3:` Need to install the required dependencies ['express', '@google/genai', 'dotenv'].

```prompt
> npm install express @google/genai dotenv
```

`Step #4:` This is the format that the json payload needs to be sent to the Google API for lyria 3 music generation model.

```javascript
// Call the Gemini API using the Lyria 3 music generation model.
const response = await ai.models.generateContentStream({
	model: 'lyria-3-clip-preview',  // 'lyria-3-clip-preview' for ~30s clips, 'lyria-3-pro-preview' for ~3min clips.
	contents: prompt,
	config: {
		responseModalities: ['AUDIO', 'TEXT'],
	},
});
```



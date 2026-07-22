# 🎵 LyriaStudio: AI Music Generator & Real-Time Audio Demixer

[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8.1.5](https://img.shields.io/badge/Vite-8.1.5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gemini Lyria 3](https://img.shields.io/badge/Google%20AI-Lyria%203-4285F4?logo=google&logoColor=white)](https://deepmind.google/technologies/lyria/)
[![WebAudio API](https://img.shields.io/badge/Web%20Audio-API-FF6F00?logo=webaudio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Module Federation](https://img.shields.io/badge/Module%20Federation-Enabled-blueviolet)](https://module-federation.io/)

**LyriaStudio MFE** is a cutting-edge, micro frontend web application built with **React 19**, **Node.js 24** and **Vite 8**. It enables users to generate studio-quality music using Google's **Gemini AI (Lyria 3)** model, receive intelligent genre/mood-based generation recommendations, and manipulate audio in real time with an embedded multitrack editor and AI stem demixer.

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

This project is architected as an isolated Micro Frontend using **Module Federation**, designed to seamlessly drop into any existing host shell application without dependency conflicts or audio thread blocking.

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

---
<b>Web Application</b>
---

<b>Scripting Language:</b> JavaScript (Node.js runtime environment)

<b>Web Framework:</b> React (JavaScript), Express (Node.js)

---

`Docker Container:` Go to the windows store to download a docker container application to use Node.js.

<img width="1920" height="1031" alt="image" src="https://github.com/user-attachments/assets/3d52df3a-31af-4f50-a4a5-ff86b353c2a2" />

<img width="1916" height="1032" alt="image" src="https://github.com/user-attachments/assets/1c49ddd4-9bf5-4136-b4ba-99f89bcb86d5" />

---
<b>Local Setup Guide (Getting Started)</b>
---

`Step 1:` Download <b>node.js</b> on your local machine to run it directly and check the version in command line.

```prompt
> node --version
```

`Step #2:` Run npm init to create an environment for an application (creates a package.json file for the application).

<img width="1107" height="639" alt="image" src="https://github.com/user-attachments/assets/82b56266-1af8-42d3-b06d-08e72f46d46a" />

`Step #3:` Create an application, and name it <b>index.js</b> using either a text editor (e.g., notepad) or IDE (e.g., VSCode).

```javascript
// This is the main entry point for your Node.js application.
const express = require('express');
const path = require('path');
const cors = require('cors'); 

// Initialize the Express application
const app = express();

// Define the port the server will run on
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes (i.e., allows the Canvas to talk to your localhost!)
app.use(cors());

// Middleware to parse incoming JSON requests
app.use(express.json());

// Serve static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

app.get('/api/greeting', (request,response) => {
	response.json({
		success: true,
		timestamp: new Date().toISOString()
	})
})

// Catches if the user goes to a route that does not exist.
app.use((req, res) => {
    res.status(404).send("Sorry, that page doesn't exist!");
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`🚀 Server is up and running!`);
    console.log(`🌐 Local frontend: http://localhost:${PORT}.`);
    console.log(`⚡ API Endpoint: http://localhost:${PORT}/api/greeting in your browser.`);
});
```

`Step #4:` Install express (can use --save to create dependencies or --no-save to not create dependencies).

```prompt
> npm install express --save
```

`Step #5:`  Run the application node <b>index.js</b> (server is running & listens to port 3000; to stop server use Control+C).

```prompt
> node index.js
```

`Step #6:` Run in the browser <b>localhost: 3000</b> on the machine.

```javascript
// --- API Endpoint ---
app.get('/api/test', (request,response) => {
	response.json({
		success: true,
		timestamp: new Date().toISOString()
	})
});
```

<img width="1034" height="234" alt="image" src="https://github.com/user-attachments/assets/67d3fc4c-c471-4ef8-9aed-aa27fa265343" />

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

`Step #4:` import these into your <b>index.js</b> application server.

```javascript
// [dotenv]: used for managing the Google Gemini API key.
require('dotenv').config();

// [express]: used for the server.
const express = require('express');

// --- Generative AI (Google) ---

// [@google/genai]: is Google's official SDK.
const { GoogleGenAI } = require('@google/genai');

// Initialize the Gemini client using an API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

`Step #5:` This is the format that the json payload needs to be sent to the Google API for lyria 3 music generation model.

```javascript
// Call the Gemini API using the Lyria 3 music generation model.
const response = await ai.models.generateContent({
	model: 'lyria-3-clip-preview',  // 'lyria-3-clip-preview' for ~30s clips, 'lyria-3-pro-preview' for ~3min clips.
	contents: prompt,
	config: {
		responseModalities: ['AUDIO', 'TEXT'],
	},
});
```



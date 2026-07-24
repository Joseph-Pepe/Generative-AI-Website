import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite'; // or '@originjs/vite-plugin-federation';

// Orchestrator: 
/*
    - It configures the Module Federation container, provides the unified navigation layout.
    - It initializes the shared Web Audio API AudioContext to prevent browser audio policy violations across boundary transitions.
*/
export default defineConfig({
  server: {
    port: 3000,
    cors: true,
  },
  // 🛠️ Add optimizeDeps to prevent caching virtual module references
  optimizeDeps: {
    exclude: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@lyria-studio/shared-types', '@lyria-studio/event-bus'],
  },
  plugins: [
    react(),
    federation({
      name: 'host_container',

      // 🛠️ Enable manifest mode on the host as well
      manifest: true,

      remotes: {
        // 🛠️ Point to the newly enabled modern manifest entry endpoint! Finds and links this micro frontend.
        mfeAudioGenerator: 'http://localhost:3001/mf-manifest.json',
        // mfeAudioRecommendations: 'http://localhost:3002/mf-manifest.json',
        // mfeAudioEditor: 'http://localhost:3003/mf-manifest.json',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        '@lyria-studio/shared-types': { singleton: true },
        '@lyria-studio/event-bus': { singleton: true },
      },
    }),
  ],
  build: {
    target: 'esnext',
  },
});
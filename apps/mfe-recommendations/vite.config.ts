import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// Exposes ./RecommendationEngine on http://localhost:3002/mf-manifest.json and shares the singleton React 19.2.8 runtime and globalThis EventBus
export default defineConfig({
  server: {
    port: 3002,
    strictPort: true,
    cors: true,
  },
  optimizeDeps: {
    exclude: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@lyria-studio/shared-types',
      '@lyria-studio/event-bus',
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    cssInjectedByJsPlugin(),
    federation({
      name: 'mfeAudioRecommendations',
      filename: 'remoteEntry.js',
      manifest: true,
      dts: false,
      exposes: {
        './RecommendationEngine': './src/components/RecommendationEngine.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.2.8' },
        'react-dom': { singleton: true, requiredVersion: '^19.2.8' },
        '@lyria-studio/shared-types': { singleton: true },
        '@lyria-studio/event-bus': { singleton: true },
      },
    }),
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: false,
  },
});
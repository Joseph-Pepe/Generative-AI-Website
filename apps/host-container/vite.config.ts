import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite'; // or '@originjs/vite-plugin-federation';

// Orchestrator: 
/*
    - It configures the Module Federation container, provides the unified navigation layout.
    - It initializes the shared Web Audio API AudioContext to prevent browser audio policy violations across boundary transitions.
*/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');
  const generatorUrl = env.VITE_MFE_GENERATOR_URL || 'http://localhost:3001/mf-manifest.json';
  const recommendationsUrl = env.VITE_MFE_RECOMMENDATIONS_URL || 'http://localhost:3002/mf-manifest.json';

  return {
    server: {
      port: 3000,
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
      federation({
        name: 'host_container',
        filename: 'remoteEntry.js',
        // 🛠️ Enable manifest mode on the host as well
        manifest: true,
        dts: false,
        exposes: {
          './providers/AudioProvider': './src/providers/AudioProvider.tsx',
        },
        remotes: {
          // 🛠️ Point to the newly enabled modern manifest entry endpoint! Finds and links this micro frontend.
          mfeAudioGenerator: generatorUrl,
          // To display RecommendationEngine side-by-side with GeneratorStudio on Port 3000:
          mfeAudioRecommendations: recommendationsUrl,
          // mfeAudioEditor: 'http://localhost:3003/mf-manifest.json',
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
      target: 'esnext',
      minify: 'esbuild',
    },
  };
});
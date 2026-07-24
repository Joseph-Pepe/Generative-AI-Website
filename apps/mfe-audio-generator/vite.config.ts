import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite'; // 1. Import Tailwind v4 Vite plugin
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'; // 1. Import the plugin

// This sets up the app to run on Port 3001 and exposes this studio component as remoteEntry.js
export default defineConfig({
  server: {
    port: 3001,
    strictPort: true,
    cors: true, // Allow the Host App on Port 3000 to fetch from this port
  },
  optimizeDeps: {
    exclude: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@lyria-studio/shared-types', '@lyria-studio/event-bus'],
  },
  plugins: [
    react(),
    tailwindcss(), // 2. Add Tailwind plugin
    cssInjectedByJsPlugin(),
    federation({
      // 1. The unique name of this micro-frontend
      name: 'mfeAudioGenerator',
      
      // 2. The manifest file the Host Container will look for
      filename: 'remoteEntry.js',

      // 🛠️ Tell Vite to generate the mf-manifest.json file with ESM metadata!
      manifest: true,

      // 🛠️ Type safety that works across all version configurations
      dts: true,
      
      // 3. The components/modules you want to share with the Host Container
      exposes: {
        // ✅ Direct expose of your studio UI component
        './GeneratorStudio': './src/components/GeneratorStudio.tsx',

        // ⚠️ Make sure this points to your actual main UI file!
        // './GeneratorStudio': './src/App.tsx', 
      },
      
      // 4. Shared dependencies so React isn't loaded twice in the browser
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        '@lyria-studio/shared-types': { singleton: true },
        '@lyria-studio/event-bus': { singleton: true },
      }
    }),
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false, // 3. Keep this FALSE so all styles bundle into one file for the plugin to inject
  }
});
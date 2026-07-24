import React, { Suspense } from 'react';
import { AudioProvider } from './providers/AudioProvider';

// Host container already manages the global stylesheet!
// GeneratorStudio component is dynamically mounted into the DOM of the host-container, it will automatically inherit any global stylesheets, CSS variables, or utility classes (like Tailwind CSS) that are already loaded on http://localhost:3000/.

// ⚠️ Dynamically import the GeneratorStudio micro-frontend from Port 3001!
const RemoteGeneratorStudio = React.lazy(() => 
  import('mfeAudioGenerator/GeneratorStudio').catch(() => ({ // Note: Make sure 'mfeAudioGenerator/GeneratorStudio' matches the name/expose set in your remote vite.config.ts!
    default: () => (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ff4444', backgroundColor: '#1a1a1a', borderRadius: '8px', margin: '2rem' }}>
        <h3>⚠️ Could not connect to Audio Generator Micro-Frontend</h3>
        <p>Make sure apps/mfe-audio-generator is running on http://localhost:3001</p>
      </div>
    )
  }))
);

// -- Main Layout Wrapper will load AudioProvider and dynamically import remote GeneratorStudio from Port 3001 using React's Module Federation support (React.lazy and Suspense) --
export default function App() {
  return (
    <AudioProvider>
      <div style={{ minHeight: '100vh', backgroundColor: '#0f0f11', color: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>
        {/* Top Navigation Bar */}
        <header style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #2a2a30', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎹</span>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, background: 'linear-gradient(90deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LyriaStudio Host Container
            </h1>
          </div>
          <span style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', backgroundColor: '#1e1e24', borderRadius: '999px', border: '1px solid #3a3a42', color: '#a1a1aa' }}>
            ⚡ Module Federation: Active
          </span>
        </header>

        {/* Micro-Frontend Mount Point */}
        <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
          <Suspense fallback={
            <div style={{ textAlign: 'center', padding: '4rem', color: '#a1a1aa' }}>
              <h2>⏳ Loading Generator Studio Micro-Frontend...</h2>
              <p>Fetching remote bundle from Port 3001...</p>
            </div>
          }>
            <RemoteGeneratorStudio />
          </Suspense>
        </main>
      </div>
    </AudioProvider>
  );
}
// Host container manages the global layout, shared 48kHz AudioProvider, and per-MFE fault isolation.
// Remote MFEs mounted into the DOM automatically communicate across boundaries via @lyria-studio/event-bus.

import React, { Component, ErrorInfo, ReactNode, Suspense } from 'react';
import { AudioProvider } from './providers/AudioProvider';

interface ErrorBoundaryProps {
  mfeName: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

// Per-MFE Error Boundary: Isolates runtime render faults to the individual remote widget
class MfeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `🔥 [${this.props.mfeName}] Micro-Frontend Render Boundary Caught Error:`,
      error,
      info.componentStack
    );
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#f87171',
            backgroundColor: '#18181b',
            borderRadius: '12px',
            border: '1px solid #ef4444',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <h3>⚠️ {this.props.mfeName} Fault Isolated</h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>{this.state.errorMessage}</p>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.25rem',
              backgroundColor: '#9333ea',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🔄 Retry Mounting {this.props.mfeName}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 1. Dynamically import the GeneratorStudio micro-frontend from Port 3001
const RemoteGeneratorStudio = React.lazy(() =>
  import('mfeAudioGenerator/GeneratorStudio').catch(() => ({
    default: () => (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#ff4444',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #3f1d1d',
        }}
      >
        <h3>⚠️ Could not connect to Audio Generator MFE</h3>
        <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>
          Ensure <code>apps/mfe-audio-generator</code> is running on{' '}
          <code>http://localhost:3001</code>
        </p>
      </div>
    ),
  }))
);

// 2. Dynamically import the RecommendationEngine micro-frontend from Port 3002
const RemoteRecommendationEngine = React.lazy(() =>
  import('mfeAudioRecommendations/RecommendationEngine').catch(() => ({
    default: () => (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#38bdf8',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #1e3a5f',
        }}
      >
        <h3>⚠️ Could not connect to Recommendations MFE</h3>
        <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>
          Ensure <code>apps/mfe-recommendations</code> is running on{' '}
          <code>http://localhost:3002</code>
        </p>
      </div>
    ),
  }))
);

export default function App() {
  return (
    <AudioProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0f0f11',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top Navigation Bar */}
        <header
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid #2a2a30',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎹</span>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: 0,
                background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              LyriaStudio Host Container
            </h1>
          </div>
          <span
            style={{
              fontSize: '0.85rem',
              padding: '0.35rem 0.75rem',
              backgroundColor: '#1e1e24',
              borderRadius: '999px',
              border: '1px solid #3a3a42',
              color: '#a1a1aa',
            }}
          >
            ⚡ Module Federation: Active (Ports 3001 &amp; 3002)
          </span>
        </header>

        {/* Side-by-Side Responsive Micro-Frontend Grid */}
        <main
          style={{
            padding: '2rem',
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
            gap: '2rem',
            alignItems: 'start',
          }}
        >
          {/* Left Column: Gemini Lyria 3 Generator Studio (Port 3001) */}
          <section style={{ width: '100%' }}>
            <MfeErrorBoundary mfeName="Audio Generator MFE">
              <Suspense
                fallback={
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '4rem',
                      color: '#a1a1aa',
                      backgroundColor: '#141418',
                      borderRadius: '12px',
                      border: '1px solid #27272a',
                    }}
                  >
                    <h2>⏳ Loading Generator Studio MFE...</h2>
                    <p>Fetching remote bundle from Port 3001...</p>
                  </div>
                }
              >
                <RemoteGeneratorStudio />
              </Suspense>
            </MfeErrorBoundary>
          </section>

          {/* Right Column: AI Prompt Enricher & Recommendations Engine (Port 3002) */}
          <section style={{ width: '100%' }}>
            <MfeErrorBoundary mfeName="Recommendations MFE">
              <Suspense
                fallback={
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '4rem',
                      color: '#a1a1aa',
                      backgroundColor: '#141418',
                      borderRadius: '12px',
                      border: '1px solid #27272a',
                    }}
                  >
                    <h2>⏳ Loading Recommendations MFE...</h2>
                    <p>Fetching remote bundle from Port 3002...</p>
                  </div>
                }
              >
                <RemoteRecommendationEngine />
              </Suspense>
            </MfeErrorBoundary>
          </section>
        </main>
      </div>
    </AudioProvider>
  );
}
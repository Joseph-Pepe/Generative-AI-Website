import GeneratorStudio from './components/GeneratorStudio';

// This acts as the exposed entry point for Module Federation!
export default function App() {
  // Renders  GeneratorStudio component and serves as the single source of truth for both standalone testing and Module Federation
  return (
    <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center">
      <div className="w-full">
        <GeneratorStudio />
      </div>
    </div>
  );
}
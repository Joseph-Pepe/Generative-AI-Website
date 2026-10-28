import RecommendationEngine from './components/RecommendationEngine';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center">
      <div className="w-full">
        <RecommendationEngine />
      </div>
    </div>
  );
}
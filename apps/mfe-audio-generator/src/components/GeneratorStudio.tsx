import { useState, useEffect, useCallback } from 'react';
import { useLyriaGenerator } from '../hooks/useLyriaGenerator';
import { eventBus } from '@lyria-studio/event-bus';

// 🛠️ Tells Vite to pass the Tailwind compilation engine over the bridge!
import '../index.css';

// 1. Type definition for PostgreSQL history rows returned by gateway
interface HistoryItem {
  id: string;
  prompt: string;
  genre: string;
  mood: string;
  bpm: number;
  createdAt?: string;
  created_at?: string; // Drizzle/Postgres fallback
}

export default function GeneratorStudio() {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('Synthwave');
  const [mood, setMood] = useState('Energetic');

  // 2. History State Management
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 1. Consume the clean streaming logic from our custom hook
  const { generateTrack, isGenerating, audioUrl, metadata, receivedBytes } = useLyriaGenerator();

  // Fast, reusable history fetcher (points to your Express Gateway on Port 8000)
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      // Note: Make sure this URL matches where your backend gateway is running!
      const res = await fetch('http://localhost:8000/api/v1/generations/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('⚠️ Could not fetch generation history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load history on component mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    
    // Notify the rest of the DAW monorepo that generation has started
    eventBus.emit('LYRIA:GENERATION_STARTED', { prompt, estimatedTime: 15 });

    // 2. Trigger the stream
    await generateTrack({
      prompt,
      genre,
      mood,
      bpm: 120,
    });

    // ⚡ React 19 Polish: Instantly refresh the history list once generation finishes!
    fetchHistory();
  };

  // Send the completed track across the Module Federation boundary to the DAW Editor
  const handleOpenInEditor = () => {
    if (metadata && audioUrl) {
      eventBus.emit('AUDIO:LOAD_INTO_EDITOR', { 
        track: { ...metadata, audioUrl }, 
        autoDemix: true 
      });
    }
  };

  // Interactive UX: Clicking a history item populates the inputs for fast iteration
  const handleSelectHistory = (item: HistoryItem) => {
    setPrompt(item.prompt);
    if (item.genre) setGenre(item.genre);
    if (item.mood) setMood(item.mood);
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-2xl max-w-xl mx-auto">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-4">
        🎵 Gemini Lyria 3 Studio
      </h2>

      <form onSubmit={handleGenerate} className="space-y-4">
        {/* Text Prompt Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Text Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cinematic cyberpunk synthwave track with driving 80s bass arpeggios..."
            className="w-full h-28 bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            required
          />
        </div>

        {/* Genre & Mood Dropdowns */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Genre</label>
            <select 
              value={genre} 
              onChange={(e) => setGenre(e.target.value)} 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            >
              <option value="Synthwave">Synthwave / Cyberpunk</option>
              <option value="Lo-Fi">Lo-Fi Hip Hop</option>
              <option value="Orchestral">Cinematic Orchestral</option>
              <option value="EDM">Mainstage EDM / House</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mood</label>
            <select 
              value={mood} 
              onChange={(e) => setMood(e.target.value)} 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            >
              <option value="Energetic">Energetic & Driving</option>
              <option value="Melancholic">Melancholic & Deep</option>
              <option value="Euphoric">Euphoric & Uplifting</option>
              <option value="Dark">Dark & Mysterious</option>
            </select>
          </div>
        </div>

        {/* Generate Button with Real-Time Byte Counter */}
        <button
          type="submit"
          disabled={isGenerating || !prompt}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50"
        >
          {isGenerating ? `⚡ Streaming... (${(receivedBytes / 1024).toFixed(1)} KB)` : '🎹 Generate Track'}
        </button>
      </form>

      {/* Audio Player & Cross-MFE Export */}
      {audioUrl && (
        <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-purple-500/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-purple-300">✅ Track Ready: {metadata?.title || 'Generated Audio'}</h4>
              <p className="text-xs text-slate-400">
                {metadata?.genre} • {metadata?.mood} • {metadata?.bpm || 120} BPM
              </p>
            </div>
            <button
              onClick={handleOpenInEditor}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-sm font-medium rounded-lg transition-colors shadow"
            >
              🎛️ Open in Editor & Demix
            </button>
          </div>
          <audio controls src={audioUrl} className="w-full" autoPlay />
        </div>
      )}

      {/* 📜 Generations History Section */}
      <div className="mt-8 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>📜 Recent Prompts</span>
            {isLoadingHistory && <span className="text-xs text-purple-400 animate-pulse">(Syncing...)</span>}
          </h3>
          <button 
            onClick={fetchHistory}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="Refresh history"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
          {history.length === 0 && !isLoadingHistory ? (
            <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-800/20 rounded-lg">
              No generations found. Create your first track above!
            </p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectHistory(item)}
                className="p-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800/80 hover:border-purple-500/40 rounded-lg transition-all cursor-pointer group flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 group-hover:text-purple-300 truncate transition-colors">
                    "{item.prompt}"
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    <span className="bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-400">{item.genre}</span>
                    <span className="bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-400">{item.mood}</span>
                    {item.created_at || item.createdAt ? (
                      <span>• {new Date(item.created_at || item.createdAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : null}
                  </div>
                </div>
                <span className="text-xs text-slate-600 group-hover:text-purple-400 transition-colors self-center">
                  ↗ Remix
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
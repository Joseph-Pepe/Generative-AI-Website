import React, { useState, useEffect, useMemo } from 'react';
import { eventBus } from '@lyria-studio/event-bus';

import '../index.css';

// Provides interactive acoustic presets, 
// a Smart Prompt Enricher that transforms basic ideas into studio-engineered Lyria 3 prompts, 
// and real-time taste profiling via LYRIA:GENERATION_COMPLETED events:
export interface AcousticPreset {
  id: string;
  title: string;
  genre: 'Synthwave' | 'Lo-Fi' | 'Orchestral' | 'EDM';
  mood: 'Energetic' | 'Melancholic' | 'Euphoric' | 'Dark';
  bpm: number;
  keySignature: string;
  tags: string[];
  prompt: string;
}

const STUDIO_PRESETS: readonly AcousticPreset[] = [
  {
    id: 'cyberpunk-pursuit',
    title: 'Neon Horizon Pursuit',
    genre: 'Synthwave',
    mood: 'Energetic',
    bpm: 128,
    keySignature: 'F Minor',
    tags: ['Analog Arp', 'Gated Reverb Snare', 'CS-80 Brass'],
    prompt:
      'High-octane outrun synthwave in F minor at 128 BPM, rolling 16th-note analog Moog sub-bass arpeggio, gated 80s LinnDrum snare, soaring Yamaha CS-80 brass lead, wide stereo mastering.',
  },
  {
    id: 'midnight-tape-lofi',
    title: 'Rainy Tokyo Tape Loop',
    genre: 'Lo-Fi',
    mood: 'Melancholic',
    bpm: 82,
    keySignature: 'D Minor 9',
    tags: ['Rhodes Mk1', 'Vinyl Crackle', 'SP-404 Swing'],
    prompt:
      'Warm nostalgic lo-fi hip hop in D minor at 82 BPM, detuned Fender Rhodes jazz chords with subtle tape wow and flutter, dusty boom-bap drum break with sidechained upright bass.',
  },
  {
    id: 'titan-cinematic',
    title: 'Orbital Singularity',
    genre: 'Orchestral',
    mood: 'Dark',
    bpm: 110,
    keySignature: 'C Minor',
    tags: ['Braaam Brass', 'Spiccato Strings', 'Taiko Ensemble'],
    prompt:
      'Massive hybrid cinematic orchestral score in C minor at 110 BPM, tense polyrhythmic spiccato cello ostinato, thunderous taiko percussion, sub-bass risers, and low brass swells.',
  },
  {
    id: 'festival-progressive',
    title: 'Solstice Mainstage Euphoria',
    genre: 'EDM',
    mood: 'Euphoric',
    bpm: 126,
    keySignature: 'A Major',
    tags: ['Supersaw Stack', 'Sidechain Pump', 'Vocal Chop'],
    prompt:
      'Uplifting progressive house anthem in A major at 126 BPM, lush 7-voice detuned supersaw chord progression, tight punchy four-on-the-floor kick, airy vocal chops, and euphoric drop.',
  },
];

const ACOUSTIC_ENRICHMENTS: Record<string, string> = {
  Synthwave: 'vintage analog polysynths, gated plate reverb, punchy sidechained sub-bass, 48kHz stereo width',
  'Lo-Fi': 'warm tube saturation, jazz 9th chord voicings, swung MPC drum groove, gentle analog tape hiss',
  Orchestral: 'full symphonic string section, concert hall acoustic space, dynamic brass crescendo, deep timpani',
  EDM: 'club-ready multiband compression, crisp high-hat transients, wide supersaw leads, sub-bass mono compatibility',
};

export default function RecommendationEngine() {
  const [seedIdea, setSeedIdea] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<AcousticPreset['genre']>('Synthwave');
  const [selectedMood, setSelectedMood] = useState<AcousticPreset['mood']>('Energetic');
  const [preferredGenre, setPreferredGenre] = useState<string | null>(null);
  const [lastAppliedId, setLastAppliedId] = useState<string | null>(null);

  // Learn user affinity dynamically when tracks finish generating in GeneratorStudio
  useEffect(() => {
    const unsubscribe = eventBus.on('LYRIA:GENERATION_COMPLETED', ({ track }) => {
      if (track.genre) {
        setPreferredGenre(track.genre);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sort presets so the user's learned genre affinity surfaces first
  const sortedPresets = useMemo(() => {
    if (!preferredGenre) return STUDIO_PRESETS;
    return [...STUDIO_PRESETS].sort((a, b) =>
      a.genre === preferredGenre ? -1 : b.genre === preferredGenre ? 1 : 0
    );
  }, [preferredGenre]);

  const handleApplyPreset = (preset: AcousticPreset) => {
    setLastAppliedId(preset.id);
    setSelectedGenre(preset.genre);
    setSelectedMood(preset.mood);

    eventBus.emit('RECOMMENDATION:APPLY_PROMPT', {
      prompt: preset.prompt,
      genre: preset.genre,
      mood: preset.mood,
    });
  };

  const handleEnrichAndApply = (e: React.FormEvent) => {
    e.preventDefault();
    const baseText = seedIdea.trim() || `A ${selectedMood.toLowerCase()} ${selectedGenre} composition`;
    const acousticTail = ACOUSTIC_ENRICHMENTS[selectedGenre] ?? ACOUSTIC_ENRICHMENTS['Synthwave'];
    const enrichedPrompt = `${baseText} — engineered with ${acousticTail}, ${selectedMood.toLowerCase()} harmonic progression, studio-mastered clarity.`;

    setLastAppliedId('custom-enriched');
    eventBus.emit('RECOMMENDATION:APPLY_PROMPT', {
      prompt: enrichedPrompt,
      genre: selectedGenre,
      mood: selectedMood,
    });
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-2xl max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            💡 AI Prompt Enricher & Acoustic Presets
          </h2>
          <p className="text-xs text-slate-400">
            Click any preset or enrich a raw idea to populate the Lyria 3 Studio instantly.
          </p>
        </div>
        {preferredGenre && (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300">
            🎯 Affinity: {preferredGenre}
          </span>
        )}
      </div>

      {/* Smart Prompt Enrichment Form */}
      <form onSubmit={handleEnrichAndApply} className="mb-6 p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-400">
          ✨ Smart Prompt Enricher
        </label>
        <input
          type="text"
          value={seedIdea}
          onChange={(e) => setSeedIdea(e.target.value)}
          placeholder="Enter a basic idea (e.g., 'late night coding beat' or 'boss fight theme')..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value as AcousticPreset['genre'])}
            className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
          >
            <option value="Synthwave">Genre: Synthwave</option>
            <option value="Lo-Fi">Genre: Lo-Fi</option>
            <option value="Orchestral">Genre: Orchestral</option>
            <option value="EDM">Genre: EDM</option>
          </select>

          <select
            value={selectedMood}
            onChange={(e) => setSelectedMood(e.target.value as AcousticPreset['mood'])}
            className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
          >
            <option value="Energetic">Mood: Energetic</option>
            <option value="Melancholic">Mood: Melancholic</option>
            <option value="Euphoric">Mood: Euphoric</option>
            <option value="Dark">Mood: Dark</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-xs font-semibold rounded-lg shadow transition-all cursor-pointer"
        >
          ⚡ Enrich & Send to Lyria 3 Studio
        </button>
      </form>

      {/* Curated Studio Presets */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          🎛️ Curated Studio Acoustic Profiles
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {sortedPresets.map((preset) => {
            const isApplied = lastAppliedId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                  isApplied
                    ? 'bg-purple-950/30 border-purple-500/70'
                    : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-800 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-slate-200 group-hover:text-cyan-300 transition-colors">
                    {preset.title}
                  </span>
                  <span className="text-[11px] font-medium text-cyan-400">
                    {isApplied ? '✓ Applied to Studio' : '↗ Apply Preset'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-2">"{preset.prompt}"</p>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                    {preset.genre}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 font-medium">
                    {preset.mood}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-700/70 text-slate-300">
                    {preset.bpm} BPM &bull; {preset.keySignature}
                  </span>
                  {preset.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
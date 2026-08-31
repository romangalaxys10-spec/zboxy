'use client';

import { useState, useCallback } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, Presentation, X, FilePlus, Lightbulb, Zap, BookOpen, Target, GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STYLES = [
  { id: 'business', label: 'Business', desc: 'Data-driven, executive tone', icon: Target, color: 'from-blue-500 to-indigo-600' },
  { id: 'creative', label: 'Creative', desc: 'Bold, storytelling approach', icon: Lightbulb, color: 'from-pink-500 to-rose-600' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean, focused messaging', icon: Zap, color: 'from-neutral-500 to-neutral-700' },
  { id: 'academic', label: 'Academic', desc: 'Research, evidence-based', icon: BookOpen, color: 'from-emerald-500 to-teal-600' },
  { id: 'pitch', label: 'Pitch Deck', desc: 'Problem-solution, CTA', icon: Target, color: 'from-orange-500 to-amber-600' },
  { id: 'education', label: 'Education', desc: 'Learning objectives, examples', icon: GraduationCap, color: 'from-violet-500 to-purple-600' },
];

const SUGGESTIONS = [
  'Introduction to Machine Learning',
  'Climate Change: Causes and Solutions',
  'The Future of Remote Work',
  'Healthy Eating Habits',
  'History of the Internet',
  'How Startups Scale from 0 to 1',
  'Artificial Intelligence in Healthcare',
  'World\'s Most Beautiful Places',
];

export default function AISlideGenerator() {
  const { token, closeFile, openFileForEdit, currentPath } = useZboxyStore();
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('business');
  const [slideCount, setSlideCount] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ name: string; id: string } | null>(null);

  const generate = useCallback(async () => {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setGenerating(true);
    setProgress('Analyzing your topic...');
    setResult(null);

    try {
      setProgress('Generating slide content with AI...');
      const res = await fetch('/api/zboxy/ai-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ topic: topic.trim(), style, slideCount, folder: currentPath }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult({ name: data.file.name, id: data.file.id });
        toast.success(`Generated ${data.slideCount} slides!`);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Generation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  }, [topic, style, slideCount, token, currentPath]);

  const openGenerated = () => {
    if (!result) return;
    // Refresh files then open
    fetch('/api/zboxy/files?folder=' + currentPath, { headers: { 'x-zboxy-token': token } })
      .then(r => r.json())
      .then(files => {
        const file = files.find((f: { id: string }) => f.id === result.id);
        if (file) openFileForEdit(file);
      });
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile}><X className="w-5 h-5" /></Button>
        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">AI Slide Generator</h1>
          <p className="text-[11px] text-slate-500">Powered by GLM AI</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Topic input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">What's your presentation about?</label>
            <Input
              className="h-12 text-base"
              placeholder="e.g., Introduction to Machine Learning"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generate()}
              disabled={generating}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                  onClick={() => setTopic(s)}
                  disabled={generating}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Style selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Choose a style</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map(s => {
                const Icon = s.icon;
                const isSelected = style === s.id;
                return (
                  <motion.button
                    key={s.id}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    onClick={() => setStyle(s.id)}
                    disabled={generating}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{s.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.desc}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Slide count */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Number of slides: <span className="text-violet-600">{slideCount}</span></label>
            <input
              type="range" min={3} max={12} value={slideCount}
              onChange={(e) => setSlideCount(parseInt(e.target.value))}
              className="w-full accent-violet-500"
              disabled={generating}
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>3 slides</span><span>12 slides</span>
            </div>
          </div>

          {/* Generate button */}
          <Button
            className="w-full h-12 text-base gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            onClick={generate}
            disabled={generating || !topic.trim()}
          >
            {generating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {progress}</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Generate with AI</>
            )}
          </Button>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-50 border border-emerald-200 rounded-xl p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Presentation className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">Presentation created!</p>
                    <p className="text-xs text-emerald-600 truncate">{result.name}</p>
                  </div>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={openGenerated}>
                    <FilePlus className="w-4 h-4" /> Open
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

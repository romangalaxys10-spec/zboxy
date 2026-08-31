'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Download, Plus, Trash2, Maximize2,
  Type, Square, Circle, Minus, Copy, Undo2, Redo2,
  ChevronLeft, ChevronRight, Layers, Palette, GripVertical,
} from 'lucide-react';

// --- Types ---
interface SlideElement {
  id: string;
  type: 'text' | 'shape';
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  bgColor: string;
  textAlign: 'left' | 'center' | 'right';
  shapeType?: 'rect' | 'circle' | 'line' | 'diamond';
  opacity: number;
  rotation: number;
}

interface Slide {
  id: string;
  elements: SlideElement[];
  background: string;
}

// --- Theme system ---
interface SlideTheme {
  name: string;
  bg: string;
  bgGradient?: string;
  titleColor: string;
  textColor: string;
  accentColor: string;
}

const THEMES: SlideTheme[] = [
  { name: 'Blank', bg: '#ffffff', titleColor: '#111827', textColor: '#374151', accentColor: '#10b981' },
  { name: 'Dark', bg: '#0f172a', titleColor: '#f1f5f9', textColor: '#94a3b8', accentColor: '#38bdf8' },
  { name: 'Ocean', bg: '#0c4a6e', titleColor: '#e0f2fe', textColor: '#bae6fd', accentColor: '#f472b6' },
  { name: 'Forest', bg: '#14532d', titleColor: '#dcfce7', textColor: '#bbf7d0', accentColor: '#fbbf24' },
  { name: 'Sunset', bg: '#7c2d12', titleColor: '#fff7ed', textColor: '#fed7aa', accentColor: '#fde68a' },
  { name: 'Violet', bg: '#2e1065', titleColor: '#ede9fe', textColor: '#c4b5fd', accentColor: '#f0abfc' },
  { name: 'Midnight', bg: '#1e1b4b', bgGradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)', titleColor: '#e0e7ff', textColor: '#a5b4fc', accentColor: '#67e8f9' },
  { name: 'Warm', bg: '#fef3c7', titleColor: '#92400e', textColor: '#78350f', accentColor: '#ea580c' },
];

// --- ID generators ---
let _slideId = 0;
let _elemId = 0;
const newSlideId = () => `s${++_slideId}-${Date.now()}`;
const newElemId = () => `e${++_elemId}-${Date.now()}`;

const makeDefaultSlide = (index: number): Slide => ({
  id: newSlideId(),
  elements: [
    {
      id: newElemId(), type: 'text', x: 8, y: index === 0 ? 25 : 10, w: 84, h: index === 0 ? 20 : 15,
      content: index === 0 ? 'Presentation Title' : `Slide ${index + 1}`,
      fontSize: index === 0 ? 44 : 28, fontWeight: 'bold', color: '#111827',
      bgColor: 'transparent', textAlign: 'center', opacity: 1, rotation: 0,
    },
    ...(index === 0 ? [{
      id: newElemId(), type: 'text' as const, x: 15, y: 52, w: 70, h: 8,
      content: 'Add your subtitle here', fontSize: 20, fontWeight: 'normal' as const, color: '#6b7280',
      bgColor: 'transparent', textAlign: 'center' as const, opacity: 1, rotation: 0,
    }] : []),
  ],
  background: '#ffffff',
});

// --- History for undo/redo ---
interface HistoryEntry {
  slides: Slide[];
  currentSlide: number;
}

export default function SlideEditor() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [slides, setSlides] = useState<Slide[]>([makeDefaultSlide(0)]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedElem, setSelectedElem] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [editText, setEditText] = useState('');
  const [editingElem, setEditingElem] = useState<string | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragState, setDragState] = useState<{ type: 'move' | 'resize'; elemId: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; handle?: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load content
  useEffect(() => {
    if (!openFile) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, { headers: { 'x-zboxy-token': token } });
        if (res.ok) {
          const d = await res.json();
          if (d.content) {
            try {
              const parsed = JSON.parse(d.content);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Migrate old format: add missing fields
                const migrated = parsed.map((s: Partial<Slide>) => ({
                  ...s,
                  elements: (s.elements || []).map((e: Partial<SlideElement>) => ({
                    opacity: e.opacity ?? 1,
                    rotation: e.rotation ?? 0,
                    ...e,
                  })),
                }));
                setSlides(migrated);
                pushHistory(migrated, 0);
              }
            } catch { /* use defaults */ }
          }
        }
      } catch { toast.error('Failed to load presentation'); }
    };
    load();
  }, [openFile, token]);

  // History management
  const pushHistory = useCallback((newSlides: Slide[], slideIdx: number) => {
    setHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, { slides: JSON.parse(JSON.stringify(newSlides)), currentSlide: slideIdx }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    if (prev) { setSlides(JSON.parse(JSON.stringify(prev.slides))); setCurrentSlide(prev.currentSlide); setHistoryIndex(historyIndex - 1); }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    if (next) { setSlides(JSON.parse(JSON.stringify(next.slides))); setCurrentSlide(next.currentSlide); setHistoryIndex(historyIndex + 1); }
  }, [history, historyIndex]);

  // Auto-save
  const saveContent = useCallback(async () => {
    if (!openFile || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ content: JSON.stringify(slides) }),
      });
      if (res.ok) setDirty(false);
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }, [openFile, saving, slides, token]);

  useEffect(() => {
    if (dirty) { const t = setTimeout(saveContent, 2000); return () => clearTimeout(t); }
  }, [dirty, saveContent]);

  // Push history on change
  const updateSlidesAndHistory = useCallback((updater: (prev: Slide[]) => Slide[]) => {
    setSlides(prev => {
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  }, []);

  // Slide operations
  const addSlide = () => {
    const newSlide = makeDefaultSlide(slides.length);
    updateSlidesAndHistory(prev => [...prev, newSlide]);
    setCurrentSlide(slides.length);
  };

  const duplicateSlide = () => {
    const src = slides[currentSlide];
    const dup: Slide = { ...src, id: newSlideId(), elements: src.elements.map(e => ({ ...e, id: newElemId() })) };
    const newSlides = [...slides];
    newSlides.splice(currentSlide + 1, 0, dup);
    updateSlidesAndHistory(() => newSlides);
    setCurrentSlide(currentSlide + 1);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    updateSlidesAndHistory(prev => prev.filter((_, i) => i !== idx));
    if (currentSlide >= slides.length - 1) setCurrentSlide(Math.max(0, slides.length - 2));
    if (currentSlide > idx && currentSlide > 0) setCurrentSlide(prev => prev - 1);
  };

  // Element operations
  const updateElement = (slideIdx: number, elemId: string, updates: Partial<SlideElement>) => {
    updateSlidesAndHistory(prev => prev.map((s, i) => {
      if (i !== slideIdx) return s;
      return { ...s, elements: s.elements.map(e => e.id === elemId ? { ...e, ...updates } : e) };
    }));
  };

  const addElement = (type: 'text' | 'shape', shapeType?: string) => {
    const elem: SlideElement = type === 'text'
      ? { id: newElemId(), type: 'text', x: 15, y: 30, w: 70, h: 12, content: 'New Text', fontSize: 22, fontWeight: 'normal', color: '#111827', bgColor: 'transparent', textAlign: 'left', opacity: 1, rotation: 0 }
      : { id: newElemId(), type: 'shape', x: 30, y: 30, w: 20, h: 15, content: '', fontSize: 16, fontWeight: 'normal', color: '#ffffff', bgColor: '#3b82f6', textAlign: 'center', shapeType: (shapeType as SlideElement['shapeType']) || 'rect', opacity: 1, rotation: 0 };
    updateSlidesAndHistory(prev => prev.map((s, i) => i === currentSlide ? { ...s, elements: [...s.elements, elem] } : s));
    setSelectedElem(elem.id);
  };

  const deleteElement = (elemId: string) => {
    updateSlidesAndHistory(prev => prev.map((s, i) => i === currentSlide ? { ...s, elements: s.elements.filter(e => e.id !== elemId) } : s));
    setSelectedElem(null);
  };

  const duplicateElement = (elem: SlideElement) => {
    const dup: SlideElement = { ...elem, id: newElemId(), x: Math.min(elem.x + 3, 80), y: Math.min(elem.y + 3, 80) };
    updateSlidesAndHistory(prev => prev.map((s, i) => i === currentSlide ? { ...s, elements: [...s.elements, dup] } : s));
    setSelectedElem(dup.id);
  };

  // Theme
  const applyTheme = (theme: SlideTheme) => {
    updateSlidesAndHistory(prev => prev.map((s, i) => {
      if (i !== currentSlide) return s;
      return {
        ...s,
        background: theme.bgGradient || theme.bg,
        elements: s.elements.map((e, idx) => ({
          ...e,
          color: idx === 0 ? theme.titleColor : theme.textColor,
        })),
      };
    }));
    setShowThemePicker(false);
  };

  // Drag handling
  const handlePointerDown = (e: React.PointerEvent, elemId: string, handle?: string) => {
    e.stopPropagation();
    const elem = slides[currentSlide].elements.find(el => el.id === elemId);
    if (!elem) return;
    setSelectedElem(elemId);
    setDragState({ type: handle ? 'resize' : 'move', elemId, startX: e.clientX, startY: e.clientY, origX: elem.x, origY: elem.y, origW: elem.w, origH: elem.h, handle });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !canvasRef.current) return;
    const canvas = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragState.startX) / canvas.width) * 100;
    const dy = ((e.clientY - dragState.startY) / canvas.height) * 100;

    if (dragState.type === 'move') {
      const nx = Math.max(0, Math.min(95, dragState.origX + dx));
      const ny = Math.max(0, Math.min(95, dragState.origY + dy));
      updateElement(currentSlide, dragState.elemId, { x: Math.round(nx), y: Math.round(ny) });
    } else if (dragState.type === 'resize') {
      const handle = dragState.handle || 'se';
      let { origX, origY, origW, origH } = dragState;
      if (handle.includes('e')) origW = Math.max(3, origW + dx);
      if (handle.includes('s')) origH = Math.max(2, origH + dy);
      if (handle.includes('w')) { origW = Math.max(3, origW - dx); origX = origX + dx; }
      if (handle.includes('n')) { origH = Math.max(2, origH - dy); origY = origY + dy; }
      updateElement(currentSlide, dragState.elemId, { x: Math.round(origX), y: Math.round(origY), w: Math.round(origW), h: Math.round(origH) });
    }
  };

  const handlePointerUp = () => {
    if (dragState) pushHistory(slides, currentSlide);
    setDragState(null);
  };

  // Keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingElem && e.key === 'Escape') { setEditingElem(null); return; }
    if (!editingElem && selectedElem) {
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteElement(selectedElem); e.preventDefault(); }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        const elem = slides[currentSlide].elements.find(el => el.id === selectedElem);
        if (elem) { duplicateElement(elem); e.preventDefault(); }
      }
      // Arrow keys to nudge
      const elem = slides[currentSlide].elements.find(el => el.id === selectedElem);
      if (elem && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const step = e.shiftKey ? 5 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        updateElement(currentSlide, selectedElem, { x: Math.max(0, elem.x + dx), y: Math.max(0, elem.y + dy) });
        e.preventDefault();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.shiftKey ? redo() : undo(); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveContent(); }
  };

  // Download
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(slides)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = openFile?.name.replace(/\.zslide$/, '.json') || 'presentation.json';
    a.click(); URL.revokeObjectURL(url);
  };

  if (!openFile) return null;
  const slide = slides[currentSlide];
  const selectedElement = slide?.elements.find(e => e.id === selectedElem);

  // --- Presentation mode ---
  if (presenting) {
    return (
      <motion.div
        className="h-screen w-screen flex items-center justify-center bg-black cursor-none overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => {
          if (currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
          else setPresenting(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === ' ') {
            if (currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
            else setPresenting(false);
          } else if (e.key === 'ArrowLeft' && currentSlide > 0) setCurrentSlide(prev => prev - 1);
          else if (e.key === 'Escape') setPresenting(false);
        }}
        tabIndex={0}
        autoFocus
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            className="w-full max-w-5xl aspect-video relative overflow-hidden"
            style={{ background: slide.background }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            {slide.elements.map(elem => (
              <div key={elem.id} className="absolute flex items-center justify-center" style={{
                left: `${elem.x}%`, top: `${elem.y}%`, width: `${elem.w}%`, height: `${elem.h}%`,
                fontSize: `${elem.fontSize}px`, fontWeight: elem.fontWeight, color: elem.color,
                backgroundColor: elem.type === 'shape' ? elem.bgColor : (elem.bgColor !== 'transparent' ? elem.bgColor : 'transparent'),
                textAlign: elem.textAlign, borderRadius: elem.shapeType === 'circle' ? '50%' : elem.type === 'shape' ? '6px' : '0',
                opacity: elem.opacity, padding: '4px',
              }}>{elem.content}</div>
            ))}
          </motion.div>
        </AnimatePresence>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
          {currentSlide + 1} / {slides.length} — Click or arrow keys to navigate, Esc to exit
        </div>
      </motion.div>
    );
  }

  // --- Editor mode ---
  const resizeHandles = (selected: boolean) => selected ? (
    <>
      {['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map(h => (
        <div key={h} className={`absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 z-20 ${
          h === 'n' || h === 's' ? 'left-1/2 -translate-x-1/2 cursor-ns-resize' :
          h === 'e' || h === 'w' ? 'top-1/2 -translate-y-1/2 cursor-ew-resize' :
          h.includes('n') && h.includes('w') ? 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' :
          h.includes('n') && h.includes('e') ? 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' :
          h.includes('s') && h.includes('w') ? 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' :
          'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
        } ${h === 'n' ? '-top-1' : h === 's' ? '-bottom-1' : h === 'w' ? '-left-1' : h === 'e' ? '-right-1' : ''}`}
          onPointerDown={(e) => handlePointerDown(e, selectedElem!, h)} />
      ))}
    </>
  ) : null;

  return (
    <div className="h-screen flex flex-col bg-neutral-100" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeFile}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="w-px h-5 bg-slate-200" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4" /></Button>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{openFile.name}</h1>
          <p className={`text-[10px] ${dirty ? 'text-amber-500' : 'text-slate-400'}`}>{saving ? 'Saving...' : dirty ? 'Unsaved' : 'Saved'}</p>
        </div>
        {/* Add elements */}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addElement('text')}><Type className="w-3 h-3" /> Text</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addElement('shape', 'rect')}><Square className="w-3 h-3" /> Rect</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addElement('shape', 'circle')}><Circle className="w-3 h-3" /> Circle</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addElement('shape', 'line')}><Minus className="w-3 h-3" /> Line</Button>
        <div className="w-px h-5 bg-slate-200" />
        {selectedElem && (<>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
            const elem = slides[currentSlide].elements.find(e => e.id === selectedElem);
            if (elem) duplicateElement(elem);
          }} title="Duplicate (Ctrl+D)"><Copy className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteElement(selectedElem)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </>)}
        <div className="w-px h-5 bg-slate-200" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowThemePicker(!showThemePicker)}><Palette className="w-3 h-3" /> Theme</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowLayers(!showLayers)}><Layers className="w-3 h-3" /> Layers</Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}><Download className="w-3.5 h-3.5" /></Button>
        <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setPresenting(true)}><Maximize2 className="w-3 h-3" /> Present</Button>
        <Button onClick={saveContent} disabled={saving || !dirty} size="sm" className="h-7 text-xs gap-1"><Save className="w-3 h-3" /> Save</Button>
      </div>

      {/* Theme picker (dropdown) */}
      <AnimatePresence>
        {showThemePicker && (
          <motion.div
            className="absolute top-12 right-32 z-50 bg-white rounded-xl shadow-xl border p-3 w-56"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          >
            <p className="text-xs font-semibold text-slate-500 mb-2">APPLY THEME</p>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((t, i) => (
                <button key={i} className="w-10 h-10 rounded-lg border-2 border-slate-200 hover:border-blue-500 transition-colors relative overflow-hidden" style={{ background: t.bgGradient || t.bg }} onClick={() => applyTheme(t)} title={t.name}>
                  <div className="absolute bottom-0.5 left-0 right-0 text-center">
                    <div className="w-4 h-0.5 mx-auto rounded" style={{ background: t.accentColor }} />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          <div
            ref={canvasRef}
            className="w-full max-w-4xl aspect-video relative shadow-2xl rounded-lg overflow-hidden"
            style={{ background: slide.background }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={() => { setSelectedElem(null); setShowThemePicker(false); setShowLayers(false); }}
          >
            {slide.elements.map(elem => {
              const isSelected = selectedElem === elem.id;
              const isLine = elem.shapeType === 'line';
              return (
                <motion.div
                  key={elem.id}
                  className={`absolute select-none ${isSelected ? 'z-10' : 'z-0'}`}
                  style={{
                    left: `${elem.x}%`, top: `${elem.y}%`, width: `${elem.w}%`, height: isLine ? '3px' : `${elem.h}%`,
                    fontSize: `${elem.fontSize}px`, fontWeight: elem.fontWeight, color: elem.color,
                    backgroundColor: elem.type === 'shape' ? elem.bgColor : (elem.bgColor !== 'transparent' ? elem.bgColor : 'transparent'),
                    textAlign: elem.textAlign,
                    borderRadius: elem.shapeType === 'circle' ? '50%' : elem.type === 'shape' ? '6px' : '0',
                    border: isSelected ? '2px solid #3b82f6' : elem.type === 'shape' ? `1px solid ${elem.color}15` : 'none',
                    opacity: elem.opacity, rotation: elem.rotation,
                    cursor: dragState?.elemId === elem.id ? (dragState.type === 'move' ? 'grabbing' : 'nwse-resize') : 'grab',
                    padding: '4px',
                  }}
                  onClick={(e) => { e.stopPropagation(); setSelectedElem(elem.id); }}
                  onPointerDown={(e) => handlePointerDown(e, elem.id)}
                  onDoubleClick={() => {
                    if (elem.type === 'text') { setEditingElem(elem.id); setEditText(elem.content); }
                  }}
                  whileHover={{ outline: isSelected ? undefined : '1px solid rgba(59,130,246,0.3)', outlineOffset: '1px' }}
                  transition={{ duration: 0.1 }}
                >
                  {editingElem === elem.id ? (
                    <textarea
                      className="w-full h-full bg-transparent border-none outline-none resize-none"
                      style={{ color: elem.color, fontSize: `${elem.fontSize}px`, fontWeight: elem.fontWeight, textAlign: elem.textAlign }}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => { updateElement(currentSlide, elem.id, { content: editText }); setEditingElem(null); }}
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditingElem(null); if (e.key === 'Tab') { e.preventDefault(); updateElement(currentSlide, elem.id, { content: editText }); setEditingElem(null); } }}
                      autoFocus
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">{elem.content}</div>
                  )}
                  {resizeHandles(isSelected)}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right panel - Properties or Layers */}
        <AnimatePresence mode="wait">
          {showLayers ? (
            <motion.aside key="layers" className="w-56 border-l bg-white p-3 shrink-0 overflow-y-auto"
              initial={{ x: 56, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 56, opacity: 0 }} transition={{ duration: 0.2 }}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Layers</h3>
              <div className="space-y-1">
                {[...slide.elements].reverse().map(elem => (
                  <button key={elem.id}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left ${selectedElem === elem.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'} transition-colors`}
                    onClick={() => setSelectedElem(elem.id)}>
                    <GripVertical className="w-3 h-3 shrink-0 text-slate-300" />
                    {elem.type === 'text' ? <Type className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                    <span className="truncate">{elem.content || elem.shapeType || 'Element'}</span>
                  </button>
                ))}
              </div>
            </motion.aside>
          ) : selectedElement ? (
            <motion.aside key="props" className="w-56 border-l bg-white p-3 space-y-3 shrink-0 overflow-y-auto"
              initial={{ x: 56, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 56, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 uppercase">Properties</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedElem(null)}><Trash2 className="w-3 h-3" /></Button>
              </div>
              {/* Content */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Content</label>
                <Input className="h-7 text-sm mt-0.5" value={selectedElement.content} onChange={(e) => updateElement(currentSlide, selectedElem!, { content: e.target.value })} />
              </div>
              {/* Typography */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide">Size</label>
                  <Input type="number" className="h-7 text-sm mt-0.5" value={selectedElement.fontSize} min={8} max={120} onChange={(e) => updateElement(currentSlide, selectedElem!, { fontSize: parseInt(e.target.value) || 16 })} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide">Weight</label>
                  <select className="w-full h-7 text-sm border rounded px-1 bg-white mt-0.5" value={selectedElement.fontWeight} onChange={(e) => updateElement(currentSlide, selectedElem!, { fontWeight: e.target.value as 'normal' | 'bold' })}>
                    <option value="normal">Regular</option><option value="bold">Bold</option>
                  </select>
                </div>
              </div>
              {/* Alignment */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Align</label>
                <div className="flex gap-1 mt-0.5">
                  {(['left', 'center', 'right'] as const).map(a => (
                    <Button key={a} variant={selectedElement.textAlign === a ? 'default' : 'outline'} size="sm" className="flex-1 h-7 text-xs" onClick={() => updateElement(currentSlide, selectedElem!, { textAlign: a })}>{a}</Button>
                  ))}
                </div>
              </div>
              {/* Colors */}
              <div className="grid grid-cols-2 gap-1.5">
                <div><label className="text-[10px] text-slate-500 uppercase tracking-wide">Color</label><Input type="color" className="h-7 p-0.5 mt-0.5" value={selectedElement.color} onChange={(e) => updateElement(currentSlide, selectedElem!, { color: e.target.value })} /></div>
                <div><label className="text-[10px] text-slate-500 uppercase tracking-wide">Fill</label><Input type="color" className="h-7 p-0.5 mt-0.5" value={selectedElement.type === 'shape' ? selectedElement.bgColor : (selectedElement.bgColor === 'transparent' ? '#ffffff' : selectedElement.bgColor)} onChange={(e) => updateElement(currentSlide, selectedElem!, { bgColor: e.target.value })} /></div>
              </div>
              {/* Opacity */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Opacity: {Math.round(selectedElement.opacity * 100)}%</label>
                <input type="range" min={0.1} max={1} step={0.05} value={selectedElement.opacity} onChange={(e) => updateElement(currentSlide, selectedElem!, { opacity: parseFloat(e.target.value) })} className="w-full mt-0.5" />
              </div>
              {/* Position & Size */}
              <div className="grid grid-cols-2 gap-1.5">
                <div><label className="text-[10px] text-slate-500 uppercase tracking-wide">X %</label><Input type="number" className="h-7 text-sm mt-0.5" value={selectedElement.x} min={0} max={100} step={1} onChange={(e) => updateElement(currentSlide, selectedElem!, { x: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="text-[10px] text-slate-500 uppercase tracking-wide">Y %</label><Input type="number" className="h-7 text-sm mt-0.5" value={selectedElement.y} min={0} max={100} step={1} onChange={(e) => updateElement(currentSlide, selectedElem!, { y: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="text-[10px] text-slate-500 uppercase tracking-wide">W %</label><Input type="number" className="h-7 text-sm mt-0.5" value={selectedElement.w} min={1} max={100} onChange={(e) => updateElement(currentSlide, selectedElem!, { w: parseInt(e.target.value) || 10 })} /></div>
                <div><label className="text-[10px] text-slate-500 uppercase tracking-wide">H %</label><Input type="number" className="h-7 text-sm mt-0.5" value={selectedElement.h} min={1} max={100} onChange={(e) => updateElement(currentSlide, selectedElem!, { h: parseInt(e.target.value) || 10 })} /></div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Bottom thumbnails */}
      <div className="border-t bg-white shrink-0 px-3 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <motion.div
              key={s.id} layout className="shrink-0 w-28 h-16 rounded-lg cursor-pointer relative overflow-hidden"
              style={{ border: i === currentSlide ? '2px solid #3b82f6' : '2px solid #e2e8f0' }}
              onClick={() => setCurrentSlide(i)}
              whileHover={{ scale: 1.05 }} transition={{ duration: 0.15 }}>
              <div className="w-full h-full relative" style={{ background: s.background }}>
                {s.elements.slice(0, 4).map(elem => (
                  <div key={elem.id} className="absolute truncate" style={{ left: `${elem.x}%`, top: `${elem.y}%`, width: `${elem.w}%`, height: `${elem.h}%`, fontSize: '4px', color: elem.color }}>{elem.content}</div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-slate-500 bg-white/80 py-0.5">{i + 1}</div>
              {slides.length > 1 && (
                <button className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); deleteSlide(i); }}>x</button>
              )}
            </motion.div>
          ))}
          <button className="shrink-0 w-28 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors" onClick={addSlide}>
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

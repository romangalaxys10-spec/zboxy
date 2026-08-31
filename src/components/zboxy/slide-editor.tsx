'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Save, Download, Plus, ChevronLeft, ChevronRight, Trash2, Maximize2 } from 'lucide-react';

interface Slide {
  id: string;
  elements: SlideElement[];
  background: string;
}

interface SlideElement {
  id: string;
  type: 'text' | 'shape';
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  bgColor: string;
  textAlign: string;
  shapeType?: string;
}

const THEMES = [
  { name: 'Blank', bg: '#ffffff', titleColor: '#1a1a1a', textColor: '#444444' },
  { name: 'Dark', bg: '#1a1a2e', titleColor: '#e0e0ff', textColor: '#b0b0d0' },
  { name: 'Ocean', bg: '#0f3460', titleColor: '#e94560', textColor: '#e0e0ff' },
  { name: 'Forest', bg: '#1b4332', titleColor: '#95d5b2', textColor: '#d8f3dc' },
  { name: 'Sunset', bg: '#ff6b35', titleColor: '#ffffff', textColor: '#fff3e0' },
  { name: 'Purple', bg: '#4a0e4e', titleColor: '#e0aaff', textColor: '#c77dff' },
];

let slideIdCounter = 0;
const genSlideId = () => `slide-${++slideIdCounter}-${Date.now()}`;
let elemIdCounter = 0;
const genElemId = () => `elem-${++elemIdCounter}-${Date.now()}`;

const createDefaultSlide = (index: number): Slide => ({
  id: genSlideId(),
  elements: [
    {
      id: genElemId(), type: 'text', x: 10, y: index === 0 ? 30 : 10, w: 80, h: index === 0 ? 20 : 15,
      content: index === 0 ? 'Presentation Title' : `Slide ${index + 1}`,
      fontSize: index === 0 ? 40 : 28, fontWeight: 'bold', color: '#1a1a1a', bgColor: 'transparent', textAlign: 'center',
    },
    ...(index === 0 ? [{
      id: genElemId(), type: 'text' as const, x: 10, y: 55, w: 80, h: 10,
      content: 'Subtitle goes here', fontSize: 20, fontWeight: 'normal', color: '#666666', bgColor: 'transparent', textAlign: 'center',
    }] : []),
  ],
  background: '#ffffff',
});

export default function SlideEditor() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [slides, setSlides] = useState<Slide[]>([createDefaultSlide(0)]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedElem, setSelectedElem] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [editText, setEditText] = useState('');
  const [editingElem, setEditingElem] = useState<string | null>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);

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
              if (Array.isArray(parsed) && parsed.length > 0) setSlides(parsed);
            } catch {}
          }
        }
      } catch {}
    };
    load();
  }, [openFile, token]);

  const saveContent = useCallback(async () => {
    if (!openFile || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ content: JSON.stringify(slides) }),
      });
      if (res.ok) { setDirty(false); toast.success('Presentation saved'); }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }, [openFile, saving, slides, token]);

  useEffect(() => {
    if (dirty) { const t = setTimeout(saveContent, 2000); return () => clearTimeout(t); }
  }, [dirty, saveContent]);

  const addSlide = () => {
    const newSlide = createDefaultSlide(slides.length);
    setSlides(prev => [...prev, newSlide]);
    setCurrentSlide(slides.length);
    setDirty(true);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    if (currentSlide >= slides.length - 1) setCurrentSlide(slides.length - 2);
    setDirty(true);
  };

  const updateSlide = (idx: number, updates: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
    setDirty(true);
  };

  const updateElement = (slideIdx: number, elemId: string, updates: Partial<SlideElement>) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx) return s;
      return { ...s, elements: s.elements.map(e => e.id === elemId ? { ...e, ...updates } : e) };
    }));
    setDirty(true);
  };

  const addTextElement = () => {
    const slide = slides[currentSlide];
    const newElem: SlideElement = {
      id: genElemId(), type: 'text', x: 20, y: 30, w: 60, h: 10,
      content: 'New Text', fontSize: 20, fontWeight: 'normal', color: '#1a1a1a', bgColor: 'transparent', textAlign: 'left',
    };
    updateSlide(currentSlide, { elements: [...slide.elements, newElem] });
    setSelectedElem(newElem.id);
  };

  const addShapeElement = () => {
    const slide = slides[currentSlide];
    const newElem: SlideElement = {
      id: genElemId(), type: 'shape', x: 30, y: 30, w: 20, h: 20,
      content: '', fontSize: 16, fontWeight: 'normal', color: '#ffffff', bgColor: '#4a90d9', textAlign: 'center', shapeType: 'rect',
    };
    updateSlide(currentSlide, { elements: [...slide.elements, newElem] });
    setSelectedElem(newElem.id);
  };

  const deleteElement = (elemId: string) => {
    const slide = slides[currentSlide];
    updateSlide(currentSlide, { elements: slide.elements.filter(e => e.id !== elemId) });
    setSelectedElem(null);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(slides)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = openFile?.name.replace('.zslide', '.json') || 'presentation.json';
    a.click(); URL.revokeObjectURL(url);
  };

  const applyTheme = (theme: typeof THEMES[0]) => {
    const slide = slides[currentSlide];
    const updated = slide.elements.map((e, i) => ({
      ...e,
      color: i === 0 ? theme.titleColor : theme.textColor,
    }));
    updateSlide(currentSlide, { background: theme.bg, elements: updated });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Delete' && selectedElem) {
      deleteElement(selectedElem);
    }
    if (editingElem && e.key === 'Escape') {
      setEditingElem(null);
    }
  };

  if (!openFile) return null;
  const slide = slides[currentSlide];

  // Presentation mode
  if (presenting) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center bg-black cursor-none"
        onClick={() => {
          if (currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
          else setPresenting(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === ' ') {
            if (currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
            else setPresenting(false);
          } else if (e.key === 'ArrowLeft') {
            if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
          } else if (e.key === 'Escape') setPresenting(false);
        }}
        tabIndex={0}
        autoFocus
      >
        <div
          className="w-full max-w-5xl aspect-video relative overflow-hidden"
          style={{ background: slide.background }}
        >
          {slide.elements.map(elem => (
            <div
              key={elem.id}
              className="absolute flex items-center justify-center"
              style={{
                left: `${elem.x}%`, top: `${elem.y}%`, width: `${elem.w}%`, height: `${elem.h}%`,
                fontSize: `${elem.fontSize}px`, fontWeight: elem.fontWeight, color: elem.color,
                backgroundColor: elem.type === 'shape' ? elem.bgColor : elem.bgColor !== 'transparent' ? elem.bgColor : 'transparent',
                textAlign: elem.textAlign as CanvasTextAlign,
                borderRadius: elem.type === 'shape' ? '8px' : '0',
                border: elem.type === 'shape' ? `2px solid ${elem.color}20` : 'none',
                padding: '4px',
              }}
            >
              {elem.content}
            </div>
          ))}
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
          {currentSlide + 1} / {slides.length} — Click or press arrows to navigate, Esc to exit
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{openFile.name}</h1>
          <p className="text-xs text-slate-500">{dirty ? 'Saving...' : 'All changes saved'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => THEMES.forEach(applyTheme)} className="text-xs gap-1">
          Theme
        </Button>
        <Button variant="outline" size="sm" onClick={addTextElement} className="text-xs gap-1">+ Text</Button>
        <Button variant="outline" size="sm" onClick={addShapeElement} className="text-xs gap-1">+ Shape</Button>
        {selectedElem && (
          <Button variant="ghost" size="icon" onClick={() => deleteElement(selectedElem)} className="text-red-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleDownload} title="Download">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPresenting(true)} className="gap-1">
          <Maximize2 className="w-4 h-4" /> Present
        </Button>
        <Button onClick={saveContent} disabled={saving} size="sm" className="gap-1.5">
          <Save className="w-4 h-4" /> Save
        </Button>
      </div>

      {/* Theme bar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-slate-50 shrink-0">
        <span className="text-xs text-slate-500 mr-1">Theme:</span>
        {THEMES.map((t, i) => (
          <button
            key={i}
            className="w-5 h-5 rounded border border-slate-300 hover:scale-110 transition-transform"
            style={{ background: t.bg }}
            title={t.name}
            onClick={() => applyTheme(t)}
          />
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide canvas */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto" ref={slideAreaRef}>
          <div
            className="w-full max-w-4xl aspect-video relative shadow-xl rounded-lg overflow-hidden"
            style={{ background: slide.background }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedElem(null); }}
          >
            {slide.elements.map(elem => (
              <div
                key={elem.id}
                className={`absolute group ${selectedElem === elem.id ? 'ring-2 ring-emerald-500 ring-offset-1' : 'hover:ring-1 hover:ring-emerald-300 hover:ring-offset-1'} cursor-move select-none`}
                style={{
                  left: `${elem.x}%`, top: `${elem.y}%`, width: `${elem.w}%`, height: `${elem.h}%`,
                  fontSize: `${elem.fontSize}px`, fontWeight: elem.fontWeight, color: elem.color,
                  backgroundColor: elem.type === 'shape' ? elem.bgColor : elem.bgColor !== 'transparent' ? elem.bgColor : 'transparent',
                  textAlign: elem.textAlign as CanvasTextAlign,
                  borderRadius: elem.type === 'shape' ? '8px' : '0',
                  border: elem.type === 'shape' ? `2px solid ${elem.color}20` : 'none',
                  padding: '4px',
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedElem(elem.id); }}
                onDoubleClick={() => {
                  if (elem.type === 'text') {
                    setEditingElem(elem.id);
                    setEditText(elem.content);
                  }
                }}
              >
                {editingElem === elem.id ? (
                  <textarea
                    className="w-full h-full bg-transparent border-none outline-none resize-none"
                    style={{ color: elem.color, fontSize: `${elem.fontSize}px`, fontWeight: elem.fontWeight, textAlign: elem.textAlign as CanvasTextAlign }}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => { updateElement(currentSlide, elem.id, { content: editText }); setEditingElem(null); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setEditingElem(null); } }}
                    autoFocus
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center overflow-hidden">{elem.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel - Element properties */}
        {selectedElem && (
          <div className="w-56 border-l bg-white p-3 space-y-3 shrink-0 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">Properties</h3>
            {slide.elements.filter(e => e.id === selectedElem).map(elem => (
              <div key={elem.id} className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500">Content</label>
                  <Input
                    className="h-7 text-sm"
                    value={elem.content}
                    onChange={(e) => updateElement(currentSlide, elem.id, { content: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-xs text-slate-500">Size</label>
                    <Input type="number" className="h-7 text-sm" value={elem.fontSize} min={8} max={120}
                      onChange={(e) => updateElement(currentSlide, elem.id, { fontSize: parseInt(e.target.value) || 16 })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Weight</label>
                    <select className="w-full h-7 text-sm border rounded px-1 bg-white"
                      value={elem.fontWeight}
                      onChange={(e) => updateElement(currentSlide, elem.id, { fontWeight: e.target.value })}>
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-xs text-slate-500">Color</label>
                    <Input type="color" className="h-7 p-0.5" value={elem.color}
                      onChange={(e) => updateElement(currentSlide, elem.id, { color: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Bkground</label>
                    <Input type="color" className="h-7 p-0.5" value={elem.type === 'shape' ? elem.bgColor : (elem.bgColor === 'transparent' ? '#ffffff' : elem.bgColor)}
                      onChange={(e) => updateElement(currentSlide, elem.id, { bgColor: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Align</label>
                  <div className="flex gap-1">
                    {['left', 'center', 'right'].map(a => (
                      <Button key={a} variant={elem.textAlign === a ? 'default' : 'outline'} size="sm" className="flex-1 h-7 text-xs"
                        onClick={() => updateElement(currentSlide, elem.id, { textAlign: a })}>{a}</Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div><label className="text-xs text-slate-500">X %</label>
                    <Input type="number" className="h-7 text-sm" value={elem.x} min={0} max={100} step={1}
                      onChange={(e) => updateElement(currentSlide, elem.id, { x: parseInt(e.target.value) || 0 })} /></div>
                  <div><label className="text-xs text-slate-500">Y %</label>
                    <Input type="number" className="h-7 text-sm" value={elem.y} min={0} max={100} step={1}
                      onChange={(e) => updateElement(currentSlide, elem.id, { y: parseInt(e.target.value) || 0 })} /></div>
                  <div><label className="text-xs text-slate-500">W %</label>
                    <Input type="number" className="h-7 text-sm" value={elem.w} min={1} max={100}
                      onChange={(e) => updateElement(currentSlide, elem.id, { w: parseInt(e.target.value) || 10 })} /></div>
                  <div><label className="text-xs text-slate-500">H %</label>
                    <Input type="number" className="h-7 text-sm" value={elem.h} min={1} max={100}
                      onChange={(e) => updateElement(currentSlide, elem.id, { h: parseInt(e.target.value) || 10 })} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom slide thumbnails */}
      <div className="border-t bg-white shrink-0 px-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={`shrink-0 w-28 h-16 rounded border-2 cursor-pointer relative overflow-hidden ${i === currentSlide ? 'border-emerald-500' : 'border-slate-300 hover:border-slate-400'}`}
              style={{ background: s.background }}
              onClick={() => setCurrentSlide(i)}
            >
              <div className="w-full h-full relative">
                {s.elements.slice(0, 3).map(elem => (
                  <div key={elem.id} className="absolute truncate" style={{
                    left: `${elem.x}%`, top: `${elem.y}%`, width: `${elem.w}%`, height: `${elem.h}%`,
                    fontSize: '4px', color: elem.color, fontWeight: elem.fontWeight,
                  }}>{elem.content}</div>
                ))}
              </div>
              {slides.length > 1 && (
                <button
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); deleteSlide(i); }}
                >x</button>
              )}
              <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] text-slate-500 bg-white/80">{i + 1}</div>
            </div>
          ))}
          <button
            className="shrink-0 w-28 h-16 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
            onClick={addSlide}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
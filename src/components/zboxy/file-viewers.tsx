'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Download, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Copy, Search, WrapText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================================
// IMAGE VIEWER — with zoom, pan, fit-to-screen, rotate
// ============================================================
export function ImageViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState(true);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setFitMode(false);
    setZoom(prev => Math.max(10, Math.min(500, prev - e.deltaY * 0.2)));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && zoom > 100) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panPos.x, y: e.clientY - panPos.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPanPos({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const resetView = () => { setZoom(100); setRotation(0); setPanPos({ x: 0, y: 0 }); setFitMode(true); };

  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800" onClick={closeFile}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="flex-1 text-sm text-neutral-300 truncate font-medium">{openFile.name}</span>
        {/* Zoom controls */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white" onClick={() => { setFitMode(false); setZoom(z => Math.max(10, z - 25)); }}><ZoomOut className="w-4 h-4" /></Button>
        <span className="text-xs text-neutral-400 w-12 text-center tabular-nums">{Math.round(zoom)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white" onClick={() => { setFitMode(false); setZoom(z => Math.min(500, z + 25)); }}><ZoomIn className="w-4 h-4" /></Button>
        <div className="w-px h-5 bg-neutral-700 mx-0.5" />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white" onClick={() => setRotation(r => (r + 90) % 360)}><RotateCw className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white" onClick={resetView} title="Fit to screen"><Maximize2 className="w-4 h-4" /></Button>
        <div className="w-px h-5 bg-neutral-700 mx-0.5" />
        <a href={src} download={openFile.name}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white"><Download className="w-4 h-4" /></Button>
        </a>
      </div>
      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={openFile.name}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: fitMode ? 'none' : `scale(${zoom / 100}) rotate(${rotation}deg) translate(${panPos.x / (zoom / 100)}px, ${panPos.y / (zoom / 100)}px)`,
            transition: isPanning ? 'none' : 'transform 0.2s ease',
          }}
          draggable={false}
        />
      </div>
      {/* Bottom bar */}
      <div className="flex items-center justify-center px-4 py-1.5 bg-neutral-900/80 text-xs text-neutral-500 shrink-0">
        {openFile.name} — Scroll to zoom, drag to pan
      </div>
    </div>
  );
}

// ============================================================
// VIDEO VIEWER — modern player with clean UI
// ============================================================
export function VideoViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [loaded, setLoaded] = useState(false);
  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;
  return (
    <div className="h-screen flex flex-col bg-black">
      <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/95 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" className="text-neutral-300 hover:text-white hover:bg-neutral-800" onClick={closeFile}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="flex-1 text-sm text-neutral-300 truncate font-medium">{openFile.name}</span>
        <a href={src} download={openFile.name}>
          <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white"><Download className="w-4 h-4" /></Button>
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center bg-black relative">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin w-10 h-10 border-2 border-white/20 border-t-white rounded-full" />
          </div>
        )}
        <video
          src={src}
          controls
          autoPlay
          className="max-w-full max-h-full"
          onCanPlay={() => setLoaded(true)}
          playsInline
        />
      </div>
    </div>
  );
}

// ============================================================
// AUDIO VIEWER — modern with animated visualizer
// ============================================================
export function AudioViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-neutral-900 via-neutral-950 to-black">
      <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/80 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" className="text-neutral-300 hover:text-white" onClick={closeFile}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="flex-1 text-sm text-neutral-300 truncate font-medium">{openFile.name}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-10 px-4">
        {/* Album art placeholder */}
        <div className={`w-40 h-40 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-500 ${playing ? 'bg-gradient-to-br from-emerald-400 to-cyan-500 scale-105' : 'bg-gradient-to-br from-neutral-700 to-neutral-800'}`}>
          <svg className={`w-20 h-20 text-white transition-all duration-300 ${playing ? 'scale-110' : ''}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        {/* Info */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-1">{openFile.name.replace(/\.[^.]+$/, '')}</h2>
          <p className="text-sm text-neutral-500">Audio File</p>
        </div>
        {/* Animated bars */}
        <div className="flex items-end gap-1 h-12">
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-emerald-500 transition-all"
              style={{
                height: playing ? `${Math.max(8, Math.random() * 48)}px` : '4px',
                animationDelay: `${i * 0.05}s`,
                transition: 'height 0.15s ease',
                opacity: playing ? 0.6 + Math.random() * 0.4 : 0.3,
              }}
            />
          ))}
        </div>
        {/* Player */}
        <audio
          ref={audioRef}
          src={src}
          controls
          autoPlay
          className="w-full max-w-md"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
    </div>
  );
}

// ============================================================
// CODE VIEWER — with search, word wrap, line numbers
// ============================================================
export function CodeViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [content, setContent] = useState('');
  const [wordWrap, setWordWrap] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCount, setSearchCount] = useState(0);

  const language = (() => {
    if (!openFile) return 'text';
    const ext = openFile.name.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
      py: 'python', java: 'java', cpp: 'cpp', c: 'c', go: 'go', rs: 'rust',
      rb: 'ruby', php: 'php', html: 'html', css: 'css', json: 'json',
      xml: 'xml', yaml: 'yaml', yml: 'yaml', sh: 'bash', sql: 'sql',
      md: 'markdown', txt: 'text', csv: 'text', svg: 'xml',
      ts: 'typescript',
    };
    return langMap[ext] || 'text';
  })();

  useEffect(() => {
    if (!openFile) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, { headers: { 'x-zboxy-token': token } });
        if (res.ok) { const d = await res.json(); setContent(d.content || ''); }
      } catch { toast.error('Failed to load file'); }
    };
    load();
  }, [openFile, token]);

  // Search count
  useEffect(() => {
    if (!searchQuery) { setSearchCount(0); return; }
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    setSearchCount((content.match(regex) || []).length);
  }, [searchQuery, content]);

  const handleCopy = () => { navigator.clipboard.writeText(content); toast.success('Copied to clipboard'); };

  if (!openFile) return null;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeFile}><ArrowLeft className="w-4 h-4" /></Button>
        <span className="flex-1 text-sm font-medium truncate">{openFile.name}</span>
        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono uppercase">{language}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen(!searchOpen)} title="Search"><Search className="w-4 h-4" /></Button>
        <Button variant={wordWrap ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setWordWrap(!wordWrap)} title="Word wrap"><WrapText className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} title="Copy content"><Copy className="w-4 h-4" /></Button>
        <a href={`/api/zboxy/files/download?id=${openFile.id}&token=${token}`} download={openFile.name}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4" /></Button>
        </a>
      </div>
      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-slate-50 shrink-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            className="flex-1 h-7 text-sm outline-none border-none bg-transparent"
            placeholder="Search in file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && <span className="text-xs text-slate-400">{searchCount} match{searchCount !== 1 ? 'es' : ''}</span>}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}><span className="text-xs">x</span></Button>
        </div>
      )}
      {/* Code */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={oneLight}
          showLineNumbers
          wrapLongLines={wordWrap}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            minHeight: '100%',
            padding: '16px',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// ============================================================
// PDF VIEWER — with loading state
// ============================================================
export function PdfViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [loading, setLoading] = useState(true);
  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;
  return (
    <div className="h-screen flex flex-col bg-neutral-100">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeFile}><ArrowLeft className="w-4 h-4" /></Button>
        <span className="flex-1 text-sm font-medium truncate">{openFile.name}</span>
        <a href={src} download={openFile.name}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4" /></Button>
        </a>
      </div>
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="text-center">
              <div className="animate-spin w-10 h-10 border-2 border-red-200 border-t-red-500 rounded-full mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading PDF...</p>
            </div>
          </div>
        )}
        <iframe
          src={src}
          className="w-full h-full border-0"
          title={openFile.name}
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}

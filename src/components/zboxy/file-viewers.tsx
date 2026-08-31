'use client';

import { useEffect, useState } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, ZoomIn, ZoomOut, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function ImageViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [zoom, setZoom] = useState(100);
  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile} className="text-slate-300 hover:text-white hover:bg-slate-800">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="flex-1 text-sm text-slate-300 truncate">{openFile.name}</span>
        <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(25, z - 25))} className="text-slate-300"><ZoomOut className="w-4 h-4" /></Button>
        <span className="text-xs text-slate-400 w-10 text-center">{zoom}%</span>
        <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(400, z + 25))} className="text-slate-300"><ZoomIn className="w-4 h-4" /></Button>
        <a href={src} download={openFile.name}>
          <Button variant="ghost" size="icon" className="text-slate-300"><Download className="w-4 h-4" /></Button>
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-auto p-8">
        <img src={src} alt={openFile.name} className="max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom / 100})` }} />
      </div>
    </div>
  );
}

export function VideoViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;
  return (
    <div className="h-screen flex flex-col bg-black">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile} className="text-slate-300"><ArrowLeft className="w-4 h-4" /></Button>
        <span className="flex-1 text-sm text-slate-300 truncate">{openFile.name}</span>
        <a href={src} download={openFile.name}><Button variant="ghost" size="icon" className="text-slate-300"><Download className="w-4 h-4" /></Button></a>
      </div>
      <div className="flex-1 flex items-center justify-center bg-black">
        <video src={src} controls autoPlay className="max-w-full max-h-full" />
      </div>
    </div>
  );
}

export function AudioViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-950">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile} className="text-slate-300"><ArrowLeft className="w-4 h-4" /></Button>
        <span className="flex-1 text-sm text-slate-300 truncate">{openFile.name}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center shadow-2xl">
          <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        <h2 className="text-xl font-semibold text-white">{openFile.name}</h2>
        <audio src={src} controls autoPlay className="w-80" />
      </div>
    </div>
  );
}

export function CodeViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [content, setContent] = useState('');

  const language = (() => {
    if (!openFile) return 'text';
    const ext = openFile.name.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
      py: 'python', java: 'java', cpp: 'cpp', c: 'c', go: 'go', rs: 'rust',
      rb: 'ruby', php: 'php', html: 'html', css: 'css', json: 'json',
      xml: 'xml', yaml: 'yaml', yml: 'yaml', sh: 'bash', sql: 'sql',
      md: 'markdown', txt: 'text', csv: 'text', svg: 'xml',
    };
    return langMap[ext] || 'text';
  })();

  useEffect(() => {
    if (!openFile) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, { headers: { 'x-zboxy-token': token } });
        if (res.ok) { const d = await res.json(); setContent(d.content || ''); }
      } catch {}
    };
    load();
  }, [openFile, token]);

  if (!openFile) return null;

  const handleCopy = () => { navigator.clipboard.writeText(content); toast.success('Copied!'); };

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile}><ArrowLeft className="w-4 h-4" /></Button>
        <span className="flex-1 text-sm font-medium truncate">{openFile.name}</span>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{language}</span>
        <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy content"><Copy className="w-4 h-4" /></Button>
        <a href={`/api/zboxy/files/download?id=${openFile.id}&token=${token}`} download={openFile.name}>
          <Button variant="ghost" size="icon"><Download className="w-4 h-4" /></Button>
        </a>
      </div>
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter language={language} style={oneLight} showLineNumbers customStyle={{ margin: 0, borderRadius: 0, minHeight: '100%', padding: '16px' }}>
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function PdfViewer() {
  const { openFile, closeFile, token } = useZboxyStore();
  if (!openFile) return null;
  const src = `/api/zboxy/files/download?id=${openFile.id}&token=${token}`;
  return (
    <div className="h-screen flex flex-col bg-slate-200">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile}><ArrowLeft className="w-4 h-4" /></Button>
        <span className="flex-1 text-sm font-medium truncate">{openFile.name}</span>
        <a href={src} download={openFile.name}>
          <Button variant="ghost" size="icon"><Download className="w-4 h-4" /></Button>
        </a>
      </div>
      <div className="flex-1">
        <iframe src={src} className="w-full h-full border-0" title={openFile.name} />
      </div>
    </div>
  );
}

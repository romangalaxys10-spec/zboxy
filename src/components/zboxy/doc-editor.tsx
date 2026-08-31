'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Download, Printer, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Heading1, Heading2,
  Heading3, Undo2, Redo2, Code, Quote, Minus
} from 'lucide-react';

const TOOLBAR_GROUPS = [
  [
    { icon: 'H1', label: 'Heading 1', cmd: 'formatBlock', val: 'H1' },
    { icon: 'H2', label: 'Heading 2', cmd: 'formatBlock', val: 'H2' },
    { icon: 'H3', label: 'Heading 3', cmd: 'formatBlock', val: 'H3' },
  ],
  [
    { icon: 'B', label: 'Bold', cmd: 'bold' },
    { icon: 'I', label: 'Italic', cmd: 'italic' },
    { icon: 'U', label: 'Underline', cmd: 'underline' },
    { icon: 'S', label: 'Strikethrough', cmd: 'strikeThrough' },
  ],
  [
    { icon: '≡', label: 'Bullet List', cmd: 'insertUnorderedList' },
    { icon: '1.', label: 'Numbered List', cmd: 'insertOrderedList' },
  ],
  [
    { icon: '←', label: 'Align Left', cmd: 'justifyLeft' },
    { icon: '↔', label: 'Align Center', cmd: 'justifyCenter' },
    { icon: '→', label: 'Align Right', cmd: 'justifyRight' },
  ],
  [
    { icon: '"', label: 'Quote', cmd: 'formatBlock', val: 'BLOCKQUOTE' },
    { icon: '</>', label: 'Code Block', cmd: 'formatBlock', val: 'PRE' },
    { icon: '—', label: 'Horizontal Rule', cmd: 'insertHorizontalRule' },
  ],
];

export default function DocEditor() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!openFile) return;
    const loadContent = async () => {
      try {
        const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
          headers: { 'x-zboxy-token': token },
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.content || '';
          setContent(text);
          // Convert markdown-like content to HTML
          const html = text
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br/>');
          setHtmlContent(html);
          if (editorRef.current) {
            editorRef.current.innerHTML = `<p>${html}</p>`;
          }
        }
      } catch {}
    };
    loadContent();
  }, [openFile, token]);

  const saveContent = useCallback(async () => {
    if (!openFile || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ content }),
      });
      if (res.ok) { setDirty(false); }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }, [openFile, saving, content, token]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setHtmlContent(html);
    // Convert HTML back to simple text/markdown
    const text = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    setContent(text);
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveContent, 2000);
  };

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleInput();
  };

  const handleUndo = () => { document.execCommand('undo'); handleInput(); };
  const handleRedo = () => { document.execCommand('redo'); handleInput(); };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = openFile?.name.replace(/\.zdoc$/, '.md') || 'document.md';
    a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  if (!openFile) return null;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-slate-50 flex-wrap shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={closeFile} title="Back to Drive">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleUndo} title="Undo"><Undo2 className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRedo} title="Redo"><Redo2 className="w-4 h-4" /></Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        {TOOLBAR_GROUPS.map((group, gi) => (
          <span key={gi} className="flex items-center gap-0.5">
            {group.map((tool, ti) => (
              <Button key={ti} variant="ghost" size="sm" className="h-8 w-8 p-0 text-sm font-bold"
                onClick={() => execCmd(tool.cmd, tool.val)} title={tool.label}>
                {tool.icon}
              </Button>
            ))}
            {gi < TOOLBAR_GROUPS.length - 1 && <div className="w-px h-6 bg-slate-200 mx-1" />}
          </span>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-slate-400 mr-2">{dirty ? 'Saving...' : 'Saved'}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download as Markdown">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.print()} title="Print">
          <Printer className="w-4 h-4" />
        </Button>
        <Button onClick={saveContent} disabled={saving} size="sm" className="gap-1.5 h-8">
          <Save className="w-3.5 h-3.5" /> Save
        </Button>
      </div>

      {/* File name bar */}
      <div className="flex items-center px-4 py-1.5 border-b bg-white shrink-0">
        <h1 className="text-sm font-medium text-slate-700 truncate">{openFile.name}</h1>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto">
        <div
          ref={editorRef}
          className="max-w-4xl mx-auto my-8 px-12 min-h-[60vh] outline-none text-base leading-relaxed text-slate-800 focus:outline-none"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          style={{ fontSize: '15px', lineHeight: '1.8' }}
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Save, Download, Printer } from 'lucide-react';

export default function DocEditor() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [markdown, setMarkdown] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [MDXEditorComponent, setMDXEditorComponent] = useState<React.ComponentType<{
    markdown: string;
    onChange: (md: string) => void;
    contentEditableClassName?: string;
    className?: string;
    plugins?: unknown[];
    readOnly?: boolean;
  }> | null>(null);
  const [toolbarPlugins, setToolbarPlugins] = useState<unknown[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamically import MDXEditor (heavy component, SSR-incompatible)
  useEffect(() => {
    let cancelled = false;
    const loadEditor = async () => {
      try {
        const mdxModule = await import('@mdxeditor/editor');
        if (cancelled) return;
        await import('@mdxeditor/editor/style.css');

        const {
          MDXEditor: Editor,
          toolbarPlugin,
          headingsPlugin,
          listsPlugin,
          quotePlugin,
          thematicBreakPlugin,
          markdownShortcutPlugin,
          linkPlugin,
          tablePlugin,
          codeBlockPlugin,
          codeMirrorPlugin,
          diffSourcePlugin,
          frontmatterPlugin,
        } = mdxModule as unknown as Record<string, unknown>;

        const ToolbarPlugin = toolbarPlugin as (opts: {
          toolbarContents: () => React.ReactNode;
        }) => unknown;
        const HeadingsPlugin = headingsPlugin as () => unknown;
        const ListsPlugin = listsPlugin as () => unknown;
        const QuotePlugin = quotePlugin as () => unknown;
        const ThematicBreakPlugin = thematicBreakPlugin as () => unknown;
        const MarkdownShortcutPlugin = markdownShortcutPlugin as () => unknown;
        const LinkPlugin = linkPlugin as () => unknown;
        const TablePlugin = tablePlugin as () => unknown;
        const CodeBlockPlugin = codeBlockPlugin as () => unknown;
        const CodeMirrorPlugin = codeMirrorPlugin as (opts?: Record<string, unknown>) => unknown;
        const DiffSourcePlugin = diffSourcePlugin as (opts?: Record<string, unknown>) => unknown;
        const FrontmatterPlugin = frontmatterPlugin as () => unknown;

        const loadedPlugins = [
          HeadingsPlugin(),
          ListsPlugin(),
          QuotePlugin(),
          ThematicBreakPlugin(),
          MarkdownShortcutPlugin(),
          LinkPlugin(),
          TablePlugin(),
          CodeBlockPlugin(),
          CodeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', ts: 'TypeScript', python: 'Python', css: 'CSS', html: 'HTML', json: 'JSON' } }),
          DiffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: '' }),
          FrontmatterPlugin(),
          ToolbarPlugin({
            toolbarContents: () => {
              const {
                UndoRedo,
                BoldItalicUnderlineToggles,
                StrikeThroughSupSubToggles,
                ListsToggle,
                BlockTypeSelect,
                CreateLink,
                InsertImage,
                InsertTable,
                InsertThematicBreak,
                InsertCodeBlock,
                InsertFrontmatter,
                DiffSourceToggleWrapper,
              } = mdxModule as unknown as Record<string, React.ComponentType>;
              return (
                <DiffSourceToggleWrapper>
                  <UndoRedo />
                  <div className="w-px h-6 bg-slate-200 mx-1" />
                  <BlockTypeSelect />
                  <BoldItalicUnderlineToggles />
                  <StrikeThroughSupSubToggles />
                  <ListsToggle />
                  <div className="w-px h-6 bg-slate-200 mx-1" />
                  <CreateLink />
                  <InsertImage />
                  <InsertTable />
                  <InsertThematicBreak />
                  <InsertCodeBlock />
                  <InsertFrontmatter />
                </DiffSourceToggleWrapper>
              );
            },
          }),
        ];

        setToolbarPlugins(loadedPlugins);
        setMDXEditorComponent(() => Editor as unknown as React.ComponentType<{
          markdown: string;
          onChange: (md: string) => void;
          contentEditableClassName?: string;
          className?: string;
          plugins?: unknown[];
          readOnly?: boolean;
        }>);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load MDXEditor:', err);
        setLoading(false);
      }
    };
    loadEditor();
    return () => { cancelled = true; };
  }, []);

  // Load content from API
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
          setMarkdown(text);
        }
      } catch {
        toast.error('Failed to load document');
      }
    };
    loadContent();
  }, [openFile, token]);

  // Save content
  const saveContent = useCallback(async () => {
    if (!openFile || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ content: markdown }),
      });
      if (res.ok) { setDirty(false); toast.success('Saved'); }
      else toast.error('Failed to save');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }, [openFile, saving, markdown, token]);

  const handleChange = useCallback((newMd: string) => {
    setMarkdown(newMd);
    setDirty(true);
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    saveTimerRef.current = setTimeout(() => saveContent(), 2000);
  }, [saveContent]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); }
    };
  }, []);

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = openFile?.name.replace(/\.zdoc$/, '.md') || 'document.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveContent();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveContent]);

  if (!openFile) return null;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-slate-50 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={closeFile} title="Back to Drive">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <div className="flex-1" />
        <span className={`text-xs mr-2 transition-colors ${dirty ? 'text-amber-500' : 'text-slate-400'}`}>
          {saving ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download as Markdown">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.print()} title="Print">
          <Printer className="w-4 h-4" />
        </Button>
        <Button onClick={saveContent} disabled={saving || !dirty} size="sm" className="gap-1.5 h-8">
          Save
        </Button>
      </div>

      {/* File name bar */}
      <div className="flex items-center px-4 py-1.5 border-b bg-white shrink-0">
        <h1 className="text-sm font-medium text-slate-700 truncate">{openFile.name}</h1>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : MDXEditorComponent ? (
          <MDXEditorComponent
            markdown={markdown}
            onChange={handleChange}
            contentEditableClassName="prose prose-slate max-w-none focus:outline-none px-16 py-8 min-h-[60vh]"
            className="max-w-4xl mx-auto"
            plugins={toolbarPlugins}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Editor failed to load. Try refreshing.</p>
          </div>
        )}
      </div>
    </div>
  );
}

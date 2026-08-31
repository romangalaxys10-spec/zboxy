'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useZboxyStore, ZboxyFile as ZFile, type ViewerType as ZboxyViewerType } from '@/lib/zboxy-store';
import { getFileCategory, formatFileSize, type FileCategory } from '@/lib/zboxy-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';

import { Separator } from '@/components/ui/separator';

import { toast, Toaster } from 'sonner';
import {
  HardDrive, Star, Trash2, Search, Grid3X3, List, Upload, FolderPlus, FilePlus,
  MoreVertical, X, Download, StarOff, FolderOpen, FileText, Table2, Presentation,
  Image as ImageIcon, Video, Music, FileArchive, FileCode, File, ChevronRight, Home,
  RefreshCw, Clock, Eye, Edit3, Folder, ArrowUp,
  Box, Menu
} from 'lucide-react';
import dynamic from 'next/dynamic';
import ErrorBoundary from './error-boundary';

const DocEditor = dynamic(() => import('./doc-editor'), { ssr: false });
const SheetEditor = dynamic(() => import('./sheet-editor'), { ssr: false });
const SlideEditor = dynamic(() => import('./slide-editor'), { ssr: false });

const ImageViewer = dynamic(() => import('./file-viewers').then(m => ({ default: m.ImageViewer })), { ssr: false });
const VideoViewer = dynamic(() => import('./file-viewers').then(m => ({ default: m.VideoViewer })), { ssr: false });
const AudioViewer = dynamic(() => import('./file-viewers').then(m => ({ default: m.AudioViewer })), { ssr: false });
const CodeViewer = dynamic(() => import('./file-viewers').then(m => ({ default: m.CodeViewer })), { ssr: false });
const PdfViewer = dynamic(() => import('./file-viewers').then(m => ({ default: m.PdfViewer })), { ssr: false });

// File icon helper
function FileIcon({ file, size = 20 }: { file: ZFile; size?: number }) {
  if (file.type === 'folder') return <Folder className="text-amber-500" style={{ width: size, height: size }} />;
  const cat = getFileCategory(file.mimeType || '', file.name);
  const iconMap: Record<FileCategory, React.ReactNode> = {
    document: <FileText className="text-blue-600" style={{ width: size, height: size }} />,
    spreadsheet: <Table2 className="text-emerald-600" style={{ width: size, height: size }} />,
    presentation: <Presentation className="text-orange-600" style={{ width: size, height: size }} />,
    image: <ImageIcon className="text-purple-500" style={{ width: size, height: size }} />,
    video: <Video className="text-red-500" style={{ width: size, height: size }} />,
    audio: <Music className="text-pink-500" style={{ width: size, height: size }} />,
    pdf: <FileText className="text-red-600" style={{ width: size, height: size }} />,
    archive: <FileArchive className="text-amber-700" style={{ width: size, height: size }} />,
    code: <FileCode className="text-slate-600" style={{ width: size, height: size }} />,
    other: <File className="text-slate-400" style={{ width: size, height: size }} />,
  };
  return <>{iconMap[cat] || iconMap.other}</>;
}

// Thumbnails for office files
function FileThumbnail({ file }: { file: ZFile }) {
  const token = useZboxyStore(s => s.token);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type === 'folder') {
    return (
      <div className="w-full h-full bg-amber-50 rounded-t-lg flex items-center justify-center">
        <Folder className="w-16 h-16 text-amber-400" />
      </div>
    );
  }
  const cat = getFileCategory(file.mimeType || '', file.name);
  if (cat === 'image') {
    return <img src={`/api/zboxy/files/download?id=${file.id}&token=${token}`} alt={file.name} className="w-full h-full object-cover rounded-t-lg" />;
  }
  const bgColors: Record<string, string> = {
    document: 'bg-blue-50', spreadsheet: 'bg-emerald-50', presentation: 'bg-orange-50',
    pdf: 'bg-red-50', code: 'bg-slate-50', video: 'bg-red-50', audio: 'bg-pink-50',
  };
  const labels: Record<string, string> = {
    zdoc: 'DOC', zsheet: 'SHEET', zslide: 'SLIDE',
    pdf: 'PDF', doc: 'DOC', docx: 'DOCX', xls: 'XLS', xlsx: 'XLSX',
    ppt: 'PPT', pptx: 'PPTX', csv: 'CSV',
  };
  return (
    <div className={`w-full h-2/3 ${bgColors[cat] || 'bg-slate-50'} rounded-t-lg flex items-center justify-center relative`}>
      <FileIcon file={file} size={48} />
      {labels[ext] && (
        <span className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded">
          {labels[ext]}
        </span>
      )}
    </div>
  );
}

// Format date
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DriveLayout() {
  const store = useZboxyStore();
  const {
    user, token, files, setFiles, currentPath, setCurrentPath,
    activeView, setActiveView, viewMode, setViewMode,
    searchQuery, setSearchQuery, selectedFiles, setSelectedFiles,
    toggleSelect, clearSelection, openFileForEdit, openFileId, openFile, editorType,
    detailPanelOpen, setDetailPanelOpen, detailFile, setDetailFile,
    newFileDialog, setNewFileDialog, renameDialog, setRenameDialog,
    loading, setLoading, closeFile, logout,
  } = store;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'doc' | 'sheet' | 'slide'>('doc');
  const [renameValue, setRenameValue] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeView === 'starred') params.set('starred', 'true');
      else if (activeView === 'trash') params.set('trashed', 'true');
      else if (activeView === 'recent') { /* fetch all non-trashed */ }
      else params.set('folder', currentPath);

      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/zboxy/files?${params}`, {
        headers: { 'x-zboxy-token': token },
      });
      if (res.ok) {
        let data = await res.json();
        // For recent view, sort by updatedAt
        if (activeView === 'recent') {
          data = data.sort((a: ZFile, b: ZFile) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 50);
        }
        setFiles(data);
      }
    } catch {}
    setLoading(false);
  }, [token, activeView, currentPath, searchQuery, setFiles, setLoading]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Auto-try login on mount is handled in page.tsx

  const handleDeleteSelected = async () => {
    try {
      const res = await fetch(`/api/zboxy/files?ids=${selectedFiles.join(',')}`, {
        method: 'DELETE',
        headers: { 'x-zboxy-token': token },
      });
      if (res.ok) { toast.success(`${selectedFiles.length} item(s) moved to trash`); clearSelection(); fetchFiles(); }
    } catch { toast.error('Failed to delete'); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedFiles.length > 0) handleDeleteSelected();
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); setSelectedFiles(files.map(f => f.id)); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedFiles, files]);

  const handleUpload = async (fileList: FileList | File[]) => {
    setUploading(true);
    let done = 0;
    const total = Array.from(fileList).length;
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', currentPath);
      try {
        const res = await fetch('/api/zboxy/files', {
          method: 'POST',
          headers: { 'x-zboxy-token': token },
          body: formData,
        });
        if (!res.ok) {
          const d = await res.json();
          toast.error(`${file.name}: ${d.error}`);
        }
      } catch { toast.error(`${file.name}: Upload failed`); }
      done++;
      setUploadProgress(Math.round((done / total) * 100));
    }
    setUploading(false);
    setUploadProgress(0);
    fetchFiles();
    toast.success(`${done} file(s) uploaded`);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    try {
      const ext = newFileType === 'doc' ? '.zdoc' : newFileType === 'sheet' ? '.zsheet' : '.zslide';
      const name = newFileName.trim() + ext;
      const res = await fetch('/api/zboxy/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ name, type: 'file', folder: currentPath, content: '' }),
      });
      if (res.ok) {
        const file = await res.json();
        toast.success(`Created ${name}`);
        setNewFileDialog(false);
        setNewFileName('');
        fetchFiles();
        openFileForEdit(file);
      } else {
        const d = await res.json();
        toast.error(d.error);
      }
    } catch { toast.error('Failed to create file'); }
  };

  const handleCreateFolder = async () => {
    const name = 'New folder';
    try {
      const res = await fetch('/api/zboxy/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ name, parent: currentPath }),
      });
      if (res.ok) { toast.success('Folder created'); fetchFiles(); }
      else { const d = await res.json(); toast.error(d.error); }
    } catch { toast.error('Failed to create folder'); }
  };

  const handleDeletePermanent = async (ids: string[]) => {
    try {
      const res = await fetch(`/api/zboxy/files?ids=${ids.join(',')}&permanent=true`, {
        method: 'DELETE',
        headers: { 'x-zboxy-token': token },
      });
      if (res.ok) { toast.success('Permanently deleted'); fetchFiles(); }
    } catch { toast.error('Failed'); }
  };

  const handleRestore = async (ids: string[]) => {
    try {
      const res = await fetch('/api/zboxy/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ ids, restore: true }),
      });
      if (res.ok) { toast.success('Restored'); fetchFiles(); }
    } catch { toast.error('Failed'); }
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await fetch('/api/zboxy/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ ids: [] }),
      });
      if (res.ok) { toast.success('Trash emptied'); fetchFiles(); }
    } catch { toast.error('Failed'); }
  };

  const handleStar = async (fileId: string) => {
    try {
      const res = await fetch('/api/zboxy/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ id: fileId }),
      });
      if (res.ok) fetchFiles();
    } catch {}
  };

  const handleRename = async () => {
    if (!renameDialog || !renameValue.trim()) return;
    try {
      const res = await fetch('/api/zboxy/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ id: renameDialog.fileId, name: renameValue.trim() }),
      });
      if (res.ok) { toast.success('Renamed'); setRenameDialog(null); fetchFiles(); }
      else { const d = await res.json(); toast.error(d.error); }
    } catch { toast.error('Failed'); }
  };

  const handleFileDoubleClick = (file: ZFile) => {
    if (file.type === 'folder') {
      const newPath = currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name;
      setCurrentPath(newPath);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const cat = getFileCategory(file.mimeType || '', file.name);

    // Office editors
    if (['zdoc', 'zsheet', 'zslide'].includes(ext)) {
      openFileForEdit(file);
      return;
    }

    // Viewers — set both openFile and viewerType atomically
    const viewerMap: Record<string, ZboxyViewerType> = {
      image: 'image', video: 'video', audio: 'audio', code: 'code', pdf: 'pdf',
    };
    const isTextFile = ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml'].includes(ext);
    const vtype = viewerMap[cat] || (isTextFile ? 'code' : null);

    if (vtype) {
      store.openFileForEdit(file);
      useZboxyStore.setState({ viewerType: vtype });
      return;
    }

    // Download unknown files
    window.open(`/api/zboxy/files/download?id=${file.id}&token=${token}`, '_blank');
  };

  const handleDownloadFile = (file: ZFile) => {
    window.open(`/api/zboxy/files/download?id=${file.id}&token=${token}`, '_blank');
  };

  const breadcrumbs = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  // If an editor or viewer is open, render it
  if (openFileId && openFile) {
    let editor: React.ReactNode = null;
    if (editorType === 'doc') editor = <DocEditor />;
    else if (editorType === 'sheet') editor = <SheetEditor />;
    else if (editorType === 'slide') editor = <SlideEditor />;
    else if (store.viewerType === 'image') editor = <ImageViewer />;
    else if (store.viewerType === 'video') editor = <VideoViewer />;
    else if (store.viewerType === 'audio') editor = <AudioViewer />;
    else if (store.viewerType === 'code') editor = <CodeViewer />;
    else if (store.viewerType === 'pdf') editor = <PdfViewer />;

    if (editor) return <ErrorBoundary>{editor}</ErrorBoundary>;
  }

  const viewTitle = activeView === 'drive' ? 'My Drive' : activeView === 'starred' ? 'Starred' : activeView === 'trash' ? 'Trash' : 'Recent';

  return (
    <div className="h-screen flex flex-col bg-white"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        if (e.dataTransfer.files.length && activeView === 'drive') handleUpload(e.dataTransfer.files);
      }}
    >
      <Toaster richColors position="top-right" />

      {/* Top Bar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b bg-white shrink-0 z-20">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-slate-100 rounded-lg">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent hidden sm:inline">Zboxy</span>
        </div>
        {/* Search */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9 h-9 bg-slate-100 border-transparent focus:border-emerald-300 focus:bg-white transition-colors"
              placeholder={`Search in ${viewTitle}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>
        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={fetchFiles} title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button variant="ghost" size="icon" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} title="Toggle view">
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More actions"><MoreVertical className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-700 ml-1">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-60 border-r bg-slate-50/50 flex flex-col shrink-0">
            <div className="p-3">
              <Button onClick={() => setNewFileDialog(true)} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                <FilePlus className="w-4 h-4" /> New
              </Button>
            </div>
            <nav className="flex-1 px-2 space-y-0.5">
              <button onClick={() => setActiveView('drive')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'drive' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <HardDrive className="w-4 h-4" /> My Drive
              </button>
              <button onClick={() => setActiveView('recent')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'recent' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Clock className="w-4 h-4" /> Recent
              </button>
              <button onClick={() => setActiveView('starred')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'starred' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Star className="w-4 h-4" /> Starred
              </button>
              <button onClick={() => setActiveView('trash')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'trash' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Trash2 className="w-4 h-4" /> Trash
              </button>
              <Separator className="my-2" />
              <button onClick={handleCreateFolder} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                <FolderPlus className="w-4 h-4" /> New Folder
              </button>
            </nav>
            <div className="p-3 border-t">
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs text-emerald-800 font-medium">Free & Unlimited</p>
                <p className="text-xs text-emerald-600 mt-0.5">All your files are stored securely.</p>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumbs */}
          {activeView === 'drive' && (
            <div className="flex items-center gap-1 px-4 py-2 border-b bg-slate-50/50 shrink-0 text-sm">
              <button onClick={() => setCurrentPath('/')} className="flex items-center gap-1 text-slate-500 hover:text-emerald-600">
                <Home className="w-4 h-4" /> My Drive
              </button>
              {breadcrumbs.map((part, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <button onClick={() => {
                    const newPath = '/' + breadcrumbs.slice(0, i + 1).join('/');
                    setCurrentPath(newPath);
                  }} className="text-slate-600 hover:text-emerald-600">
                    {part}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
            <span className="text-sm font-medium text-slate-700">{viewTitle}</span>
            {activeView === 'drive' && currentPath !== '/' && (
              <Button variant="ghost" size="sm" onClick={() => { const parts = currentPath.split('/').filter(Boolean); parts.pop(); setCurrentPath(parts.length ? '/' + parts.join('/') : '/'); }} className="gap-1 ml-2">
                <ArrowUp className="w-3 h-3" /> Back
              </Button>
            )}
            <div className="flex-1" />
            {selectedFiles.length > 0 && (
              <>
                <span className="text-xs text-slate-500">{selectedFiles.length} selected</span>
                <Button variant="outline" size="sm" onClick={() => {
                  selectedFiles.forEach(id => handleStar(id));
                }} className="gap-1"><Star className="w-3 h-3" /> Star</Button>
                {activeView !== 'trash' && (
                  <Button variant="outline" size="sm" onClick={handleDeleteSelected} className="gap-1 text-red-600"><Trash2 className="w-3 h-3" /> Delete</Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearSelection}><X className="w-3 h-3" /></Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5" disabled={activeView === 'trash'}>
              <Upload className="w-3.5 h-3.5" /> Upload
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
            {activeView === 'trash' && files.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleEmptyTrash} className="gap-1 text-red-600">Empty Trash</Button>
            )}
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="px-4 py-2 bg-emerald-50 border-b flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="text-xs text-emerald-700">{uploadProgress}%</span>
            </div>
          )}

          {/* Drag overlay */}
          {dragOver && (
            <div className="fixed inset-0 bg-emerald-500/10 border-2 border-dashed border-emerald-500 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-xl p-8 shadow-xl text-center">
                <Upload className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="text-lg font-medium text-slate-700">Drop files to upload</p>
              </div>
            </div>
          )}

          {/* File content */}
          <div className="flex-1 overflow-auto" onClick={() => clearSelection()}>
            {loading && files.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                {searchQuery ? (
                  <><Search className="w-12 h-12 text-slate-300 mb-3" /><p className="text-slate-500">No results for &quot;{searchQuery}&quot;</p></>
                ) : activeView === 'trash' ? (
                  <><Trash2 className="w-12 h-12 text-slate-300 mb-3" /><p className="text-slate-500">Trash is empty</p></>
                ) : activeView === 'starred' ? (
                  <><Star className="w-12 h-12 text-slate-300 mb-3" /><p className="text-slate-500">No starred files</p></>
                ) : (
                  <><FolderOpen className="w-12 h-12 text-slate-300 mb-3" /><p className="text-slate-500">This folder is empty</p>
                  <p className="text-sm text-slate-400 mt-1">Upload files or create new documents</p></>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-1 p-4">
                {files.map(file => (
                  <ContextMenu key={file.id}>
                    <ContextMenuTrigger>
                      <div
                        className={`group relative border rounded-lg hover:shadow-md transition-all cursor-pointer ${selectedFiles.includes(file.id) ? 'border-emerald-500 bg-emerald-50/50' : 'border-transparent hover:border-slate-200'}`}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); setDetailFile(file); }}
                        onDoubleClick={() => handleFileDoubleClick(file)}
                      >
                        <FileThumbnail file={file} />
                        <div className="p-2 flex items-start gap-2">
                          <Checkbox
                            checked={selectedFiles.includes(file.id)}
                            onCheckedChange={() => toggleSelect(file.id)}
                            className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{file.type === 'folder' ? 'Folder' : formatFileSize(file.size)}</p>
                          </div>
                          {file.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleFileDoubleClick(file)}><Eye className="w-4 h-4 mr-2" /> Open</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setRenameDialog({ open: true, fileId: file.id, name: file.name }); setRenameValue(file.name); }}><Edit3 className="w-4 h-4 mr-2" /> Rename</ContextMenuItem>
                      <ContextMenuItem onClick={() => handleStar(file.id)}>{file.starred ? <><StarOff className="w-4 h-4 mr-2" /> Unstar</> : <><Star className="w-4 h-4 mr-2" /> Star</>}</ContextMenuItem>
                      <ContextMenuItem onClick={() => handleDownloadFile(file)}><Download className="w-4 h-4 mr-2" /> Download</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem className="text-red-600" onClick={() => {
                        if (activeView === 'trash') handleDeletePermanent([file.id]);
                        else { setSelectedFiles([file.id]); handleDeleteSelected(); }
                      }}><Trash2 className="w-4 h-4 mr-2" /> {activeView === 'trash' ? 'Delete permanently' : 'Move to trash'}</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr>
                    <th className="w-10 px-4 py-2"><Checkbox checked={files.length > 0 && selectedFiles.length === files.length} onCheckedChange={(checked) => setSelectedFiles(checked ? files.map(f => f.id) : [])} /></th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 hidden md:table-cell">Owner</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 hidden sm:table-cell">Modified</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 hidden lg:table-cell">Size</th>
                    <th className="w-10 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {files.map(file => (
                    <ContextMenu key={file.id}>
                      <ContextMenuTrigger>
                        <tr
                          className={`border-b hover:bg-slate-50 cursor-pointer transition-colors ${selectedFiles.includes(file.id) ? 'bg-emerald-50' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); setDetailFile(file); }}
                          onDoubleClick={() => handleFileDoubleClick(file)}
                        >
                          <td className="px-4 py-1"><Checkbox checked={selectedFiles.includes(file.id)} onCheckedChange={() => toggleSelect(file.id)} onClick={(e) => e.stopPropagation()} /></td>
                          <td className="py-1 px-3">
                            <div className="flex items-center gap-3">
                              <FileIcon file={file} />
                              <span className="truncate font-medium">{file.name}</span>
                            </div>
                          </td>
                          <td className="py-1 px-3 text-slate-500 hidden md:table-cell">{user?.name || 'me'}</td>
                          <td className="py-1 px-3 text-slate-500 hidden sm:table-cell">{formatTime(file.updatedAt)}</td>
                          <td className="py-1 px-3 text-slate-500 hidden lg:table-cell">{file.type === 'folder' ? '--' : formatFileSize(file.size)}</td>
                          <td className="px-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleFileDoubleClick(file)}><Eye className="w-4 h-4 mr-2" /> Open</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRenameDialog({ open: true, fileId: file.id, name: file.name }); setRenameValue(file.name); }}><Edit3 className="w-4 h-4 mr-2" /> Rename</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStar(file.id)}>{file.starred ? <><StarOff className="w-4 h-4 mr-2" /> Unstar</> : <><Star className="w-4 h-4 mr-2" /> Star</>}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadFile(file)}><Download className="w-4 h-4 mr-2" /> Download</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => {
                                  if (activeView === 'trash') handleDeletePermanent([file.id]);
                                  else { setSelectedFiles([file.id]); handleDeleteSelected(); }
                                }}><Trash2 className="w-4 h-4 mr-2" /> {activeView === 'trash' ? 'Delete forever' : 'Move to trash'}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleFileDoubleClick(file)}><Eye className="w-4 h-4 mr-2" /> Open</ContextMenuItem>
                        <ContextMenuItem onClick={() => { setRenameDialog({ open: true, fileId: file.id, name: file.name }); setRenameValue(file.name); }}><Edit3 className="w-4 h-4 mr-2" /> Rename</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDownloadFile(file)}><Download className="w-4 h-4 mr-2" /> Download</ContextMenuItem>
                        <ContextMenuItem className="text-red-600" onClick={() => {
                          if (activeView === 'trash') handleDeletePermanent([file.id]);
                          else { setSelectedFiles([file.id]); handleDeleteSelected(); }
                        }}><Trash2 className="w-4 h-4 mr-2" /> {activeView === 'trash' ? 'Delete forever' : 'Move to trash'}</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t bg-slate-50 text-xs text-slate-500 shrink-0">
            <span>{files.length} item{files.length !== 1 ? 's' : ''}</span>
            <span>Free & unlimited storage</span>
          </div>
        </main>

        {/* Detail Panel */}
        {detailPanelOpen && detailFile && (
          <aside className="w-72 border-l bg-white p-4 space-y-4 shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Details</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailPanelOpen(false)}><X className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="flex flex-col items-center py-4">
              <FileIcon file={detailFile} size={64} />
              <p className="font-medium mt-3 text-center break-all">{detailFile.name}</p>
              <p className="text-xs text-slate-500 mt-1">{detailFile.type === 'folder' ? 'Folder' : getFileCategory(detailFile.mimeType || '', detailFile.name)}</p>
            </div>
            <Separator />
            <div className="space-y-3 text-sm">
              <div><span className="text-slate-500">Size</span><p className="font-medium">{detailFile.type === 'folder' ? '--' : formatFileSize(detailFile.size)}</p></div>
              <div><span className="text-slate-500">Location</span><p className="font-medium break-all">{detailFile.path || '/'}</p></div>
              <div><span className="text-slate-500">Created</span><p className="font-medium">{formatDate(detailFile.createdAt)}</p></div>
              <div><span className="text-slate-500">Modified</span><p className="font-medium">{formatTime(detailFile.updatedAt)}</p></div>
              <div><span className="text-slate-500">Starred</span><p className="font-medium">{detailFile.starred ? 'Yes' : 'No'}</p></div>
              {detailFile.mimeType && <div><span className="text-slate-500">Type</span><p className="font-medium text-xs break-all">{detailFile.mimeType}</p></div>}
            </div>
            <Separator />
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleFileDoubleClick(detailFile)}><Eye className="w-3.5 h-3.5" /> Open</Button>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleDownloadFile(detailFile)}><Download className="w-3.5 h-3.5" /> Download</Button>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleStar(detailFile.id)}>{detailFile.starred ? <><StarOff className="w-3.5 h-3.5" /> Unstar</> : <><Star className="w-3.5 h-3.5" /> Star</>}</Button>
            </div>
          </aside>
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={newFileDialog} onOpenChange={setNewFileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">File Name</label>
              <Input placeholder="Untitled" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="grid grid-cols-3 gap-3">
                {[{ type: 'doc' as const, icon: FileText, label: 'Document', desc: 'Rich text editor', color: 'text-blue-600 bg-blue-50' },
                  { type: 'sheet' as const, icon: Table2, label: 'Spreadsheet', desc: 'Cells & formulas', color: 'text-emerald-600 bg-emerald-50' },
                  { type: 'slide' as const, icon: Presentation, label: 'Presentation', desc: 'Slides & themes', color: 'text-orange-600 bg-orange-50' },
                ].map(opt => (
                  <button key={opt.type} onClick={() => setNewFileType(opt.type)} className={`p-3 rounded-lg border-2 text-center transition-all ${newFileType === opt.type ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <opt.icon className={`w-8 h-8 mx-auto mb-1 ${opt.color.split(' ')[0]}`} />
                    <p className="text-xs font-medium">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFile} disabled={!newFileName.trim()} className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameDialog?.open} onOpenChange={() => setRenameDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>Cancel</Button>
            <Button onClick={handleRename} className="bg-emerald-600 hover:bg-emerald-700">Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



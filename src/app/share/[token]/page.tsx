'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Box, Download, Lock, Eye, Folder, FileText, Table2, Presentation,
  Image as ImageIcon, Video, Music, File, FileCode, FileArchive,
  ChevronRight, Clock, User, AlertCircle, Loader2, Copy, Check, X,
  Brain, Github,
} from 'lucide-react';

type ShareData = {
  type: 'file' | 'folder';
  file: {
    id: string; name: string; type: string; mimeType?: string;
    size?: number; createdAt: string; updatedAt: string;
    category?: string; sizeFormatted?: string;
  };
  owner?: string;
  children?: Array<{
    id: string; name: string; type: string; mimeType?: string;
    size: number; category: string; sizeFormatted: string;
    createdAt: string; updatedAt: string;
  }>;
  hasContent?: boolean;
};

function getCategoryIcon(category?: string, type?: string) {
  if (type === 'folder') return <Folder className="w-5 h-5 text-amber-500" />;
  const cat = category || '';
  if (cat === 'document') return <FileText className="w-5 h-5 text-blue-600" />;
  if (cat === 'spreadsheet') return <Table2 className="w-5 h-5 text-emerald-600" />;
  if (cat === 'presentation') return <Presentation className="w-5 h-5 text-orange-600" />;
  if (cat === 'image') return <ImageIcon className="w-5 h-5 text-purple-500" />;
  if (cat === 'video') return <Video className="w-5 h-5 text-red-500" />;
  if (cat === 'audio') return <Music className="w-5 h-5 text-pink-500" />;
  if (cat === 'code') return <FileCode className="w-5 h-5 text-slate-600" />;
  if (cat === 'archive') return <FileArchive className="w-5 h-5 text-amber-700" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchShare = useCallback(async (pw?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = pw ? `/api/share/${token}?password=${encodeURIComponent(pw)}` : `/api/share/${token}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.status === 401 && json.requiresPassword) {
        setRequiresPassword(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Access denied');
        setLoading(false);
        return;
      }
      setData(json);
    } catch {
      setError('Failed to load shared content');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchShare(); }, [fetchShare]);

  const handleDownload = () => {
    const url = password ? `/api/share/${token}?download=true&password=${encodeURIComponent(password)}` : `/api/share/${token}?download=true`;
    window.open(url, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // File viewer logic
  const [textContent, setTextContent] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  const handleViewContent = async () => {
    if (textContent !== null) { setShowContent(!showContent); return; }
    try {
      const url = password ? `/api/share/${token}?content=true&password=${encodeURIComponent(password)}` : `/api/share/${token}?content=true`;
      const res = await fetch(url);
      const json = await res.json();
      setTextContent(json.content || '');
      setShowContent(true);
    } catch { setError('Failed to load content'); }
  };

  // Determine if we can show inline preview
  const mime = data?.file?.mimeType || '';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isPdf = mime === 'application/pdf';
  const isText = data?.hasContent || ['text/plain', 'text/markdown', 'text/html', 'text/css', 'text/csv', 'application/json', 'application/xml'].includes(mime);
  const isZdoc = data?.file?.name?.endsWith('.zdoc');
  const isZsheet = data?.file?.name?.endsWith('.zsheet');
  const canPreview = isImage || isVideo || isAudio || isPdf || isText || isZdoc || isZsheet;

  const mediaUrl = password ? `/api/share/${token}?password=${encodeURIComponent(password)}` : `/api/share/${token}`;

  // Password screen
  if (requiresPassword && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Password Required</h1>
          <p className="text-sm text-slate-500 mb-6">This shared link is password-protected</p>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && password && fetchShare(password)}
              className="text-center"
            />
            <Button
              onClick={() => fetchShare(password)}
              disabled={!password}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Unlock
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">Loading shared content...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link Not Available</h1>
          <p className="text-sm text-slate-500 mb-6">{error || 'This shared link could not be found'}</p>
          <Button variant="outline" onClick={() => window.location.href = '/'}>Go to Zboxy</Button>
        </div>
      </div>
    );
  }

  // Success - render the share view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Box className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Zboxy</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500 truncate">Shared: {data.file.name}</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
          <Button size="sm" onClick={handleDownload} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        {/* File/Folder info card */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              {getCategoryIcon(data.file.category, data.file.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">{data.file.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                {data.owner && (
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Shared by {data.owner}</span>
                )}
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDate(data.file.updatedAt)}</span>
                {data.type === 'file' && data.file.sizeFormatted && (
                  <span>{data.file.sizeFormatted}</span>
                )}
                {data.type === 'folder' && data.children && (
                  <span>{data.children.length} item{data.children.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview area for files */}
        {data.type === 'file' && canPreview && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-4">
            <div className="px-4 py-2 border-b bg-slate-50 flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Preview</span>
            </div>
            <div className="p-4">
              {isImage && (
                <img src={mediaUrl} alt={data.file.name} className="max-w-full max-h-[70vh] mx-auto rounded-lg" />
              )}
              {isVideo && (
                <video src={mediaUrl} controls className="max-w-full max-h-[70vh] mx-auto rounded-lg" />
              )}
              {isAudio && (
                <div className="flex items-center justify-center py-8">
                  <audio src={mediaUrl} controls className="w-full max-w-lg" />
                </div>
              )}
              {isPdf && (
                <iframe src={mediaUrl} className="w-full h-[70vh] rounded-lg border-0" title="PDF" />
              )}
              {(isText || isZdoc) && (
                <div>
                  <Button variant="outline" size="sm" onClick={handleViewContent} className="mb-3 gap-1.5">
                    {showContent ? <X className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showContent ? 'Hide Content' : 'View Content'}
                  </Button>
                  {showContent && textContent !== null && (
                    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto max-h-[60vh] text-sm whitespace-pre-wrap font-mono">
                      {textContent}
                    </pre>
                  )}
                </div>
              )}
              {isZsheet && (
                <div>
                  <Button variant="outline" size="sm" onClick={handleViewContent} className="mb-3 gap-1.5">
                    {showContent ? <X className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showContent ? 'Hide Content' : 'View Raw Content'}
                  </Button>
                  {showContent && textContent !== null && (
                    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto max-h-[60vh] text-sm whitespace-pre-wrap font-mono">
                      {textContent}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Folder contents */}
        {data.type === 'folder' && data.children && data.children.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50">
              <span className="text-sm font-medium text-slate-700">Folder Contents</span>
            </div>
            <div className="divide-y">
              {data.children.map(child => (
                <div key={child.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  {getCategoryIcon(child.category, child.type)}
                  <span className="flex-1 truncate text-sm font-medium">{child.name}</span>
                  <span className="text-xs text-slate-400 hidden sm:inline">{child.type === 'folder' ? '--' : child.sizeFormatted}</span>
                  <span className="text-xs text-slate-400 hidden md:inline">{formatDate(child.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.type === 'folder' && (!data.children || data.children.length === 0) && (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">This folder is empty</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Brain className="w-3.5 h-3.5 text-emerald-500" />
            <span>Built with <span className="font-semibold text-slate-500">Z.AI GLM 5 Turbo</span></span>
          </div>
          <p className="text-xs text-slate-300">
            Shared via <span className="font-semibold text-slate-500">Zboxy</span>
          </p>
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <a href="https://github.com/rommarkdev/zboxy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">GitHub</a>
            <span>Developed by <a href="https://www.rommark.dev" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Roman</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}

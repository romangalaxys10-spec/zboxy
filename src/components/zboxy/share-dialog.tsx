'use client';

import { useEffect, useState, useCallback } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Link2, Copy, Check, Trash2, Plus, Lock, Unlock, Clock, ExternalLink,
  Loader2, AlertCircle, X,
} from 'lucide-react';
import { toast } from 'sonner';

interface ShareLink {
  id: string;
  fileId: string;
  token: string;
  password: string | null;
  expiresAt: string | null;
  enabled: boolean;
  createdAt: string;
}

interface ShareDialogProps {
  fileId: string | null;
  fileName: string;
  onClose: () => void;
}

export default function ShareDialog({ fileId, fileName, onClose }: ShareDialogProps) {
  const token = useZboxyStore(s => s.token);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [expiresHours, setExpiresHours] = useState('');
  const [error, setError] = useState('');

  const fetchLinks = useCallback(async () => {
    if (!fileId || !token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/zboxy/share?fileId=${fileId}`, {
        headers: { 'x-zboxy-token': token },
      });
      if (res.ok) {
        setLinks(await res.json());
      } else {
        setError('Failed to load share links');
      }
    } catch {
      setError('Failed to load share links');
    }
    setLoading(false);
  }, [fileId, token]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const createLink = async () => {
    if (!fileId || !token) return;
    setCreating(true);
    setError('');
    try {
      const body: Record<string, unknown> = {};
      if (newPassword) body.password = newPassword;
      if (expiresHours) body.expiresInHours = parseInt(expiresHours);

      const res = await fetch('/api/zboxy/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ fileId, ...body }),
      });
      if (res.ok) {
        const link = await res.json();
        setLinks(prev => [link, ...prev]);
        setShowCreateForm(false);
        setNewPassword('');
        setExpiresHours('');
        toast.success('Share link created');
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create link');
      }
    } catch {
      setError('Failed to create link');
    }
    setCreating(false);
  };

  const deleteLink = async (linkId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/zboxy/share?id=${linkId}`, {
        method: 'DELETE',
        headers: { 'x-zboxy-token': token },
      });
      if (res.ok) {
        setLinks(prev => prev.filter(l => l.id !== linkId));
        toast.success('Link removed');
      }
    } catch {}
  };

  const toggleEnabled = async (link: ShareLink) => {
    if (!token) return;
    try {
      const res = await fetch('/api/zboxy/share', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ id: link.id, enabled: !link.enabled }),
      });
      if (res.ok) {
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, enabled: !l.enabled } : l));
      }
    } catch {}
  };

  const copyLink = (link: ShareLink) => {
    const url = `${window.location.origin}/share/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Link copied to clipboard');
  };

  const getExpiryLabel = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never expires';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `Expires in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Expires in ${days}d`;
  };

  return (
    <Dialog open={!!fileId} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            Share &ldquo;{fileName}&rdquo;
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : links.length === 0 && !showCreateForm ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-500 mb-4">No share links yet. Create one to let anyone access this {fileName.endsWith('/') ? 'folder' : 'file'}.</p>
            <Button onClick={() => setShowCreateForm(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" /> Create Share Link
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* Existing links */}
            {links.map(link => (
              <div key={link.id} className={`border rounded-lg p-3 ${!link.enabled ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded flex-1 truncate font-mono">
                    {window.location.origin}/share/{link.token}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyLink(link)} title="Copy link">
                    {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => toggleEnabled(link)} title={link.enabled ? 'Disable' : 'Enable'}>
                    {link.enabled ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-400 hover:text-red-600" onClick={() => deleteLink(link.id)} title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    {link.password ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {link.password ? 'Password protected' : 'Public'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getExpiryLabel(link.expiresAt)}
                  </span>
                  <a
                    href={`/share/${link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-emerald-600 hover:underline ml-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </a>
                </div>
              </div>
            ))}

            {/* Create new link form */}
            {showCreateForm && (
              <div className="border-2 border-dashed border-emerald-200 rounded-lg p-4 bg-emerald-50/50">
                <p className="text-sm font-medium text-slate-700 mb-3">New Share Link</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-1">
                      <Lock className="w-3 h-3" /> Password (optional)
                    </label>
                    <Input
                      type="text"
                      placeholder="Leave empty for public access"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3" /> Expires in (optional)
                    </label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
                      value={expiresHours}
                      onChange={(e) => setExpiresHours(e.target.value)}
                    >
                      <option value="">Never</option>
                      <option value="1">1 hour</option>
                      <option value="24">24 hours</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={createLink} disabled={creating} className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                      {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {creating ? 'Creating...' : 'Create Link'}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowCreateForm(false); setNewPassword(''); setExpiresHours(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add link button when links exist */}
            {links.length > 0 && !showCreateForm && (
              <Button variant="outline" onClick={() => setShowCreateForm(true)} className="w-full gap-2 border-dashed">
                <Plus className="w-4 h-4" /> Add Another Link
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

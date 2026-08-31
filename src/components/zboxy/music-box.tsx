'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast, Toaster } from 'sonner';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Upload, Shuffle, Repeat, Music, X, ListMusic, Heart,
  FolderOpen, Search, MoreVertical, Trash2, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Track {
  id: string;
  name: string;
  src: string;
  duration?: number;
}

export default function MusicBox() {
  const { token, closeFile, openFileForEdit } = useZboxyStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Load audio files from user's storage
  const loadTracks = useCallback(async () => {
    try {
      const res = await fetch('/api/zboxy/files?search=', { headers: { 'x-zboxy-token': token } });
      if (res.ok) {
        const allFiles = await res.json();
        const audioFiles = allFiles
          .filter((f: { mimeType?: string | null; name: string; type: string; trashed: boolean }) => {
            if (f.type === 'folder' || f.trashed) return false;
            const mime = f.mimeType || '';
            return mime.startsWith('audio/') ||
              /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus|webm)$/i.test(f.name);
          })
          .map((f: { id: string; name: string }) => ({
            id: f.id,
            name: f.name.replace(/\.[^.]+$/, ''),
            src: `/api/zboxy/files/download?id=${f.id}&token=${token}`,
          }));
        setTracks(audioFiles);
      }
    } catch {}
  }, [token]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  // Audio events
  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    if (repeat === 'one') { audioRef.current?.play(); return; }
    playNext();
  };

  // Playback controls
  const playTrack = (index: number) => {
    setCurrentTrack(index);
    setPlaying(true);
    setTimeout(() => audioRef.current?.play(), 50);
  };

  const togglePlay = () => {
    if (currentTrack === -1 && tracks.length > 0) { playTrack(0); return; }
    if (playing) audioRef.current?.pause();
    else audioRef.current?.play();
    setPlaying(!playing);
  };

  const playNext = () => {
    if (tracks.length === 0) return;
    let next: number;
    if (shuffle) {
      next = Math.floor(Math.random() * tracks.length);
      while (next === currentTrack && tracks.length > 1) next = Math.floor(Math.random() * tracks.length);
    } else {
      next = currentTrack + 1;
      if (next >= tracks.length) { if (repeat === 'all') next = 0; else { setPlaying(false); return; } }
    }
    playTrack(next);
  };

  const playPrev = () => {
    if (tracks.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3) { audioRef.current.currentTime = 0; return; }
    let prev = currentTrack - 1;
    if (prev < 0) prev = repeat === 'all' ? tracks.length - 1 : 0;
    playTrack(prev);
  };

  // Seek
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioRef.current) { audioRef.current.currentTime = pct * duration; setCurrentTime(pct * duration); }
  };

  // Upload music files
  const handleUpload = async (fileList: FileList | File[]) => {
    setUploading(true);
    let done = 0;
    const total = Array.from(fileList).length;
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', '/Music');
      try {
        const res = await fetch('/api/zboxy/files', { method: 'POST', headers: { 'x-zboxy-token': token }, body: formData });
        if (!res.ok) { const d = await res.json(); toast.error(`${file.name}: ${d.error}`); }
      } catch { toast.error(`${file.name}: Upload failed`); }
      done++;
      setUploadProgress(Math.round((done / total) * 100));
    }
    setUploading(false);
    setUploadProgress(0);
    loadTracks();
    toast.success(`${done} track(s) uploaded to /Music`);
  };

  // Delete track
  const deleteTrack = async (trackId: string) => {
    try {
      const res = await fetch(`/api/zboxy/files?ids=${trackId}`, { method: 'DELETE', headers: { 'x-zboxy-token': token } });
      if (res.ok) { toast.success('Track moved to trash'); loadTracks(); if (currentTrack >= tracks.length - 1) setPlaying(false); }
    } catch { toast.error('Failed to delete'); }
  };

  // Filtered tracks
  const filteredTracks = tracks.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (showFavoritesOnly && !favorites.has(t.id)) return false;
    return true;
  });

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const activeTrack = currentTrack >= 0 ? tracks[currentTrack] : null;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
      <Toaster richColors position="top-right" />
      <audio
        ref={audioRef}
        src={activeTrack?.src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        volume={muted ? 0 : volume}
      />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 shrink-0">
        <Button variant="ghost" size="icon" className="text-neutral-300 hover:text-white hover:bg-neutral-800" onClick={closeFile}>
          <X className="w-5 h-5" />
        </Button>
        <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-violet-600 rounded-xl flex items-center justify-center">
          <Music className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Music Box</h1>
          <p className="text-[11px] text-neutral-500">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className={showFavoritesOnly ? 'text-pink-400' : 'text-neutral-400'} onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}>
          <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-pink-400' : ''}`} />
        </Button>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
        <input ref={folderInputRef} type="file" accept="audio/*" multiple className="hidden" webkitdirectory onChange={(e) => e.target.files && handleUpload(e.target.files)} />
        <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white gap-1" onClick={() => folderInputRef.current?.click()}>
          <FolderOpen className="w-4 h-4" /> Folder
        </Button>
        <Button size="sm" className="gap-1.5 bg-pink-600 hover:bg-pink-700" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4" /> Upload
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            className="pl-9 h-9 bg-neutral-800/60 border-neutral-700 text-white placeholder:text-neutral-600 focus:border-pink-500/50"
            placeholder="Search tracks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="px-4 py-1.5 bg-pink-500/10 border-b border-neutral-800 flex items-center gap-3">
          <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-pink-500 to-violet-500 rounded-full" animate={{ width: `${uploadProgress}%` }} />
          </div>
          <span className="text-xs text-pink-400">{uploadProgress}%</span>
        </div>
      )}

      {/* Track list */}
      <div className="flex-1 overflow-auto px-2 py-2">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ListMusic className="w-16 h-16 text-neutral-700 mb-3" />
            <p className="text-neutral-500 text-sm">{search ? 'No tracks match your search' : 'No music yet'}</p>
            <p className="text-neutral-600 text-xs mt-1">Upload audio files to get started</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTracks.map((track, i) => {
              const actualIndex = tracks.indexOf(track);
              const isActive = actualIndex === currentTrack;
              const isFav = favorites.has(track.id);
              return (
                <motion.div
                  key={track.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-colors ${
                    isActive ? 'bg-gradient-to-r from-pink-500/20 to-violet-500/20 border border-pink-500/30' : 'hover:bg-neutral-800/60 border border-transparent'
                  }`}
                  onClick={() => playTrack(actualIndex)}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Track number / playing indicator */}
                  <div className="w-8 text-center shrink-0">
                    {isActive && playing ? (
                      <div className="flex items-center justify-center gap-[2px] h-4">
                        {[0, 1, 2].map(bar => (
                          <motion.div
                            key={bar}
                            className="w-[3px] bg-pink-500 rounded-full"
                            animate={{ height: [4, 12, 6, 14, 4] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: bar * 0.15 }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className={`text-xs ${isActive ? 'text-pink-400 font-semibold' : 'text-neutral-500'}`}>{i + 1}</span>
                    )}
                  </div>

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-pink-300' : 'text-neutral-200'}`}>{track.name}</p>
                    <p className="text-[11px] text-neutral-600">Track</p>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost" size="icon" className={`h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ${isFav ? 'text-pink-400 opacity-100' : 'text-neutral-500'}`}
                    onClick={(e) => { e.stopPropagation(); setFavorites(prev => { const n = new Set(prev); n.has(track.id) ? n.delete(track.id) : n.add(track.id); return n; }); }}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-pink-400' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Now Playing Bar */}
      <div className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur-lg shrink-0">
        {/* Progress bar */}
        <div ref={progressRef} className="h-1 bg-neutral-800 cursor-pointer group" onClick={handleProgressClick}>
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all relative"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 px-4 py-3">
          {/* Track info */}
          <div className="flex items-center gap-3 w-56 min-w-0">
            {activeTrack ? (
              <>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{activeTrack.name}</p>
                  <p className="text-[11px] text-neutral-500">{playing ? 'Playing' : 'Paused'}</p>
                </div>
              </>
            ) : (
              <div className="text-neutral-600 text-sm">No track selected</div>
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className={`h-8 w-8 ${shuffle ? 'text-pink-400' : 'text-neutral-400'}`} onClick={() => setShuffle(!shuffle)}>
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-neutral-200 hover:text-white" onClick={playPrev}>
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              className="w-11 h-11 rounded-full bg-white text-black hover:bg-neutral-200"
              size="icon"
              onClick={togglePlay}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-neutral-200 hover:text-white" onClick={playNext}>
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className={`h-8 w-8 ${repeat !== 'off' ? 'text-pink-400' : 'text-neutral-400'}`} onClick={() => setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')}>
              <Repeat className="w-4 h-4" />
              {repeat === 'one' && <span className="absolute text-[8px] font-bold">1</span>}
            </Button>
          </div>

          {/* Time + Volume */}
          <div className="flex items-center gap-3 w-56 justify-end">
            <span className="text-[11px] text-neutral-500 tabular-nums">{formatTime(currentTime)}</span>
            <span className="text-[11px] text-neutral-600">/</span>
            <span className="text-[11px] text-neutral-500 tabular-nums">{formatTime(duration)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400" onClick={() => setMuted(!muted)}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <input
              type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              className="w-20 h-1 accent-pink-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

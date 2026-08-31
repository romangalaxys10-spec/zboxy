import { promises as fs } from 'fs';
import path from 'path';

export const STORAGE_ROOT = '/tmp/my-project/zboxy';

export async function ensureUserDir(userId: string) {
  const dir = path.join(STORAGE_ROOT, userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function getUserDir(userId: string) {
  return path.join(STORAGE_ROOT, userId);
}

export function getFilePath(userId: string, filePath: string) {
  return path.join(STORAGE_ROOT, userId, filePath);
}

export async function deletePhysicalFile(userId: string, filePath: string) {
  const full = getFilePath(userId, filePath);
  try {
    await fs.unlink(full);
  } catch {}
}

export async function deletePhysicalDir(userId: string, dirPath: string) {
  const full = getFilePath(userId, dirPath);
  try {
    await fs.rm(full, { recursive: true, force: true });
  } catch {}
}

export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map(len =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    )
    .join('-');
}

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function getMimeType(name: string): string {
  const ext = getFileExtension(name);
  const map: Record<string, string> = {
    // Documents
    txt: 'text/plain',
    md: 'text/markdown',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    jsx: 'text/javascript',
    json: 'application/json',
    xml: 'application/xml',
    csv: 'text/csv',
    // Office-like
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Images
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    // PDF
    pdf: 'application/pdf',
    // Archives
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };
  return map[ext] || 'application/octet-stream';
}

export type FileCategory = 'document' | 'spreadsheet' | 'presentation' | 'image' | 'video' | 'audio' | 'pdf' | 'archive' | 'code' | 'other';

export function getFileCategory(mimeType: string, name: string): FileCategory {
  const ext = getFileExtension(name);
  if (['doc', 'docx', 'txt', 'md', 'html', 'rtf', 'odt'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'spreadsheet';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'presentation';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'sh', 'sql'].includes(ext)) return 'code';
  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

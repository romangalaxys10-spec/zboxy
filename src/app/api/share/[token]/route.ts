import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFilePath, getFileCategory, formatFileSize } from '@/lib/zboxy';
import { promises as fs } from 'fs';

// GET /api/share/[token] - access shared file/folder info (no auth required)
// Query params:
//   password=xxx (if link is password-protected)
//   download=true (force download)
//   content=true (get file content for text-based files)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: shareToken } = await params;

    const shareLink = await db.zboxyShareLink.findUnique({
      where: { token: shareToken },
      include: { file: true, user: { select: { name: true } } },
    });

    if (!shareLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    if (!shareLink.enabled) {
      return NextResponse.json({ error: 'This link has been disabled' }, { status: 403 });
    }

    // Check expiration
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 403 });
    }

    // Check password
    if (shareLink.password) {
      const providedPassword = req.nextUrl.searchParams.get('password');
      if (!providedPassword || providedPassword !== shareLink.password) {
        return NextResponse.json({ error: 'Password required', requiresPassword: true }, { status: 401 });
      }
    }

    const file = shareLink.file;
    const download = req.nextUrl.searchParams.get('download') === 'true';
    const content = req.nextUrl.searchParams.get('content') === 'true';

    // If it's a folder, list its contents
    if (file.type === 'folder') {
      const folderPath = file.path === '/' ? '/' + file.name : file.path + '/' + file.name;
      const children = await db.zboxyFile.findMany({
        where: { userId: file.userId, path: folderPath, trashed: false },
        orderBy: [{ type: 'desc' }, { name: 'asc' }],
      });
      return NextResponse.json({
        type: 'folder',
        file: {
          id: file.id, name: file.name, type: file.type, createdAt: file.createdAt, updatedAt: file.updatedAt,
        },
        owner: shareLink.user.name,
        children: children.map(c => ({
          id: c.id, name: c.name, type: c.type, mimeType: c.mimeType,
          size: c.size, createdAt: c.createdAt, updatedAt: c.updatedAt,
          category: getFileCategory(c.mimeType || '', c.name),
          sizeFormatted: formatFileSize(c.size),
        })),
      });
    }

    // If downloading the file
    if (download) {
      if (file.content !== null && file.content !== undefined) {
        const blob = new Blob([file.content], { type: file.mimeType || 'text/plain' });
        return new NextResponse(blob, {
          headers: {
            'Content-Type': file.mimeType || 'text/plain',
            'Content-Disposition': `attachment; filename="${file.name}"`,
          },
        });
      }
      const diskPath = getFilePath(file.userId, file.path + '/' + file.name);
      try {
        const buffer = await fs.readFile(diskPath);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file.name}"`,
            'Content-Length': String(buffer.length),
          },
        });
      } catch {
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      }
    }

    // If requesting text content (for viewer)
    if (content) {
      let textContent = '';
      if (file.content !== null && file.content !== undefined) {
        textContent = file.content;
      } else {
        const diskPath = getFilePath(file.userId, file.path + '/' + file.name);
        try {
          const buffer = await fs.readFile(diskPath);
          textContent = buffer.toString('utf-8');
        } catch { /* empty */ }
      }
      return NextResponse.json({ type: 'file', content: textContent });
    }

    // For image/video/audio, serve the binary directly for inline display
    const mime = file.mimeType || '';
    if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
      if (file.content !== null && file.content !== undefined) {
        const blob = new Blob([file.content], { type: mime });
        return new NextResponse(blob, {
          headers: {
            'Content-Type': mime,
            'Content-Disposition': `inline; filename="${file.name}"`,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      const diskPath = getFilePath(file.userId, file.path + '/' + file.name);
      try {
        const buffer = await fs.readFile(diskPath);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mime,
            'Content-Disposition': `inline; filename="${file.name}"`,
            'Content-Length': String(buffer.length),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch {
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      }
    }

    // Default: return file metadata
    return NextResponse.json({
      type: 'file',
      file: {
        id: file.id, name: file.name, type: file.type, mimeType: file.mimeType,
        size: file.size, createdAt: file.createdAt, updatedAt: file.updatedAt,
        category: getFileCategory(file.mimeType || '', file.name),
        sizeFormatted: formatFileSize(file.size),
      },
      owner: shareLink.user.name,
      hasContent: file.content !== null && file.content !== undefined,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

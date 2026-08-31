import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserDir, getFilePath, ensureUserDir } from '@/lib/zboxy';
import { promises as fs } from 'fs';
import path from 'path';

function getUser(req: NextRequest) {
  const token = req.headers.get('x-zboxy-token');
  if (!token) return null;
  return db.zboxyUser.findUnique({ where: { token } });
}

// GET /api/zboxy/content?id=xxx - get file content for editor
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'File ID required' }, { status: 400 });

    const file = await db.zboxyFile.findUnique({ where: { id, userId: user.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // For office files, return stored content
    if (file.content !== null && file.content !== undefined) {
      return NextResponse.json({ id: file.id, name: file.name, content: file.content, mimeType: file.mimeType });
    }

    // For physical files, read from disk
    if (file.type === 'file') {
      const diskPath = getFilePath(user.id, file.path + '/' + file.name);
      try {
        const buffer = await fs.readFile(diskPath);
        const text = buffer.toString('utf-8');
        return NextResponse.json({ id: file.id, name: file.name, content: text, mimeType: file.mimeType });
      } catch {
        return NextResponse.json({ id: file.id, name: file.name, content: '', mimeType: file.mimeType });
      }
    }

    return NextResponse.json({ id: file.id, name: file.name, content: '', mimeType: file.mimeType });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/zboxy/content?id=xxx - save file content from editor
export async function PUT(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'File ID required' }, { status: 400 });

    const { content } = await req.json();
    const file = await db.zboxyFile.findUnique({ where: { id, userId: user.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // For office files, store in DB
    if (file.content !== null && file.content !== undefined) {
      await db.zboxyFile.update({
        where: { id },
        data: { content, size: new TextEncoder().encode(content).length },
      });
    } else {
      // For physical text files, write to disk
      const userDir = getUserDir(user.id);
      const diskPath = path.join(userDir, file.path + '/' + file.name);
      await ensureUserDir(user.id);
      if (file.path !== '/') {
        await fs.mkdir(path.join(userDir, file.path), { recursive: true });
      }
      await fs.writeFile(diskPath, content, 'utf-8');
      await db.zboxyFile.update({
        where: { id },
        data: { size: new TextEncoder().encode(content).length },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

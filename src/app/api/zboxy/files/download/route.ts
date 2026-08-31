import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFilePath } from '@/lib/zboxy';
import { promises as fs } from 'fs';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const token = req.nextUrl.searchParams.get('token') || req.headers.get('x-zboxy-token');

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    const user = await db.zboxyUser.findUnique({ where: { token } });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!id) return NextResponse.json({ error: 'File ID required' }, { status: 400 });

    const file = await db.zboxyFile.findUnique({ where: { id, userId: user.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // For office files stored in DB
    if (file.content !== null && file.content !== undefined) {
      const blob = new Blob([file.content], { type: file.mimeType || 'text/plain' });
      return new NextResponse(blob, {
        headers: {
          'Content-Type': file.mimeType || 'text/plain',
          'Content-Disposition': `inline; filename="${file.name}"`,
        },
      });
    }

    // For physical files
    const diskPath = getFilePath(user.id, file.path + '/' + file.name);
    try {
      const buffer = await fs.readFile(diskPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${file.name}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
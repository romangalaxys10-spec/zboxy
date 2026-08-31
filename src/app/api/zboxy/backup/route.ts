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

// GET /api/zboxy/backup — export all user data as JSON
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const files = await db.zboxyFile.findMany({
      where: { userId: user.id },
      orderBy: [{ path: 'asc' }, { name: 'asc' }],
    });

    // Collect all data into a backup object
    const backup = {
      version: 1,
      exportDate: new Date().toISOString(),
      user: { name: user.name },
      files: files.map(f => ({
        name: f.name,
        type: f.type,
        mimeType: f.mimeType,
        path: f.path,
        starred: f.starred,
        trashed: f.trashed,
        content: f.content,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="zboxy-backup-${Date.now()}.json"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/zboxy/backup — import/restore from JSON backup
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('backup') as File | null;
    if (!file) return NextResponse.json({ error: 'No backup file provided' }, { status: 400 });

    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.files || !Array.isArray(backup.files)) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    await ensureUserDir(user.id);
    let imported = 0;
    let skipped = 0;

    // Collect existing paths to detect duplicates
    const existing = await db.zboxyFile.findMany({
      where: { userId: user.id },
      select: { path: true, name: true, trashed: true },
    });
    const existingSet = new Set(existing.map(f => `${f.path}/${f.name}`));

    for (const f of backup.files) {
      const key = `${f.path || '/'}/${f.name}`;
      if (existingSet.has(key)) { skipped++; continue; }

      await db.zboxyFile.create({
        data: {
          userId: user.id,
          name: f.name,
          type: f.type || 'file',
          mimeType: f.mimeType || null,
          path: f.path || '/',
          size: f.content ? new TextEncoder().encode(f.content).length : 0,
          content: f.content ?? null,
          starred: f.starred || false,
          trashed: false, // Always restore as non-trashed
        },
      });
      imported++;
    }

    return NextResponse.json({ success: true, imported, skipped, total: backup.files.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUserDir, getUserDir, getMimeType } from '@/lib/zboxy';
import { promises as fs } from 'fs';
import path from 'path';

function getUser(req: NextRequest) {
  const token = req.headers.get('x-zboxy-token');
  if (!token) return null;
  return db.zboxyUser.findUnique({ where: { token } });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, parent } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const folderPath = parent || '/';

    const existing = await db.zboxyFile.findFirst({
      where: { userId: user.id, path: folderPath, name, type: 'folder', trashed: false },
    });
    if (existing) {
      return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 });
    }

    const userDir = getUserDir(user.id);
 await ensureUserDir(user.id);
    const diskPath = path.join(userDir, folderPath, name);
    await fs.mkdir(diskPath, { recursive: true });

    const folder = await db.zboxyFile.create({
      data: {
        userId: user.id,
        name,
        type: 'folder',
        path: folderPath,
        mimeType: 'inode/directory',
        size: 0,
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
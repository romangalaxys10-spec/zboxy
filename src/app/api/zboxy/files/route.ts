import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUserDir, getUserDir, getFilePath, getMimeType, getFileCategory, deletePhysicalFile, deletePhysicalDir } from '@/lib/zboxy';
import { promises as fs } from 'fs';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

function getUser(req: NextRequest) {
  const token = req.headers.get('x-zboxy-token');
  if (!token) return null;
  return db.zboxyUser.findUnique({ where: { token } });
}

// GET /api/zboxy/files?folder=/path&trashed=false&starred=false&search=query
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const folder = req.nextUrl.searchParams.get('folder') || '/';
    const trashed = req.nextUrl.searchParams.get('trashed') === 'true';
    const starred = req.nextUrl.searchParams.get('starred') === 'true';
    const search = req.nextUrl.searchParams.get('search') || '';

    const where: Record<string, unknown> = { userId: user.id };
    if (trashed) {
      where.trashed = true;
    } else {
      where.trashed = false;
      if (starred) {
        where.starred = true;
      } else {
        where.path = folder === '/' ? '/' : folder;
      }
    }
    if (search) {
      where.name = { contains: search };
    }

    const files = await db.zboxyFile.findMany({
      where,
      orderBy: [{ type: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json(files);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/zboxy/files - upload file or create new office file
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureUserDir(user.id);
    const userDir = getUserDir(user.id);
    const contentType = req.headers.get('content-type') || '';

    // Check if it's a new office file creation (JSON body)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { name, type: fileType, folder, mimeType: providedMime, content } = body;

      if (!name || !fileType) {
        return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
      }

      const folderPath = folder || '/';
      const existing = await db.zboxyFile.findFirst({
        where: { userId: user.id, path: folderPath, name, trashed: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'A file with this name already exists' }, { status: 409 });
      }

      const file = await db.zboxyFile.create({
        data: {
          userId: user.id,
          name,
          type: fileType,
          mimeType: providedMime || getMimeType(name),
          path: folderPath,
          size: 0,
          content: content || '',
        },
      });
      return NextResponse.json(file, { status: 201 });
    }

    // File upload (multipart)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || '/';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check duplicate
    const existing = await db.zboxyFile.findFirst({
      where: { userId: user.id, path: folder, name: file.name, trashed: false },
    });
    if (existing) {
      return NextResponse.json({ error: 'A file with this name already exists' }, { status: 409 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const relativePath = folder === '/' ? '/' : folder;

    if (folder !== '/') {
      await mkdir(path.join(userDir, folder), { recursive: true });
    }

    const diskPath = path.join(userDir, relativePath, file.name);
    await writeFile(diskPath, buffer);

    const mime = getMimeType(file.name);
    const dbFile = await db.zboxyFile.create({
      data: {
        userId: user.id,
        name: file.name,
        type: 'file',
        mimeType: mime,
        path: relativePath,
        size: buffer.length,
      },
    });

    return NextResponse.json(dbFile, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/zboxy/files?id=xxx or ?ids=a,b,c
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    const ids = req.nextUrl.searchParams.get('ids');
    const permanent = req.nextUrl.searchParams.get('permanent') === 'true';

    let targetIds: string[] = [];
    if (ids) {
      targetIds = ids.split(',');
    } else if (id) {
      targetIds = [id];
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'No file IDs provided' }, { status: 400 });
    }

    const files = await db.zboxyFile.findMany({
      where: { id: { in: targetIds }, userId: user.id },
    });

    if (permanent) {
      for (const f of files) {
        if (f.type === 'folder') {
          await deletePhysicalDir(user.id, f.path + '/' + f.name);
          // Also delete all children from DB
          await db.zboxyFile.deleteMany({
            where: { userId: user.id, path: { startsWith: f.path + '/' + f.name } },
          });
        } else {
          await deletePhysicalFile(user.id, f.path + '/' + f.name);
        }
      }
      await db.zboxyFile.deleteMany({ where: { id: { in: targetIds }, userId: user.id } });
    } else {
      await db.zboxyFile.updateMany({
        where: { id: { in: targetIds }, userId: user.id },
        data: { trashed: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
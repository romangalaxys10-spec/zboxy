import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deletePhysicalFile, deletePhysicalDir, getUserDir } from '@/lib/zboxy';
import path from 'path';

function getUser(req: NextRequest) {
  const token = req.headers.get('x-zboxy-token');
  if (!token) return null;
  return db.zboxyUser.findUnique({ where: { token } });
}

// POST /api/zboxy/trash - restore or trash files
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ids, restore } = await req.json();
    if (!ids || !Array.isArray(ids)) return NextResponse.json({ error: 'IDs array required' }, { status: 400 });

    await db.zboxyFile.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { trashed: !restore },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/zboxy/trash - permanently delete trashed files
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ids } = await req.json();

    let targetIds: string[] = [];

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific files
      targetIds = ids;
    } else {
      // Empty trash - get all trashed files
      const trashed = await db.zboxyFile.findMany({ where: { userId: user.id, trashed: true }, select: { id: true } });
      targetIds = trashed.map(f => f.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Clean up physical files
    const files = await db.zboxyFile.findMany({
      where: { id: { in: targetIds }, userId: user.id, trashed: true },
    });

    for (const f of files) {
      if (f.type === 'folder') {
        const folderFullPath = f.path === '/' ? '/' + f.name : f.path + '/' + f.name;
        await deletePhysicalDir(user.id, folderFullPath);
        // Delete all children from DB
        await db.zboxyFile.deleteMany({
          where: { userId: user.id, path: { startsWith: folderFullPath } },
        });
      } else {
        const filePath = f.path === '/' ? f.name : f.path + '/' + f.name;
        await deletePhysicalFile(user.id, filePath);
      }
    }

    await db.zboxyFile.deleteMany({
      where: { id: { in: targetIds }, userId: user.id, trashed: true },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

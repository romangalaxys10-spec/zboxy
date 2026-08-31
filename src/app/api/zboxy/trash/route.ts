import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

// DELETE /api/zboxy/trash - permanently delete
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids)) return NextResponse.json({ error: 'IDs array required' }, { status: 400 });

    const files = await db.zboxyFile.findMany({
      where: { id: { in: ids }, userId: user.id, trashed: true },
    });

    for (const f of files) {
      if (f.type === 'folder') {
        await db.zboxyFile.deleteMany({
          where: { userId: user.id, path: { startsWith: f.path === '/' ? '/' + f.name : f.path + '/' + f.name } },
        });
      }
    }

    await db.zboxyFile.deleteMany({
      where: { id: { in: ids }, userId: user.id, trashed: true },
    });

    // Empty trash
    if (ids.length === 0) {
      const trashed = await db.zboxyFile.findMany({ where: { userId: user.id, trashed: true } });
      const trashedIds = trashed.map(f => f.id);
      await db.zboxyFile.deleteMany({ where: { id: { in: trashedIds }, userId: user.id } });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

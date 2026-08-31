import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function getUser(req: NextRequest) {
  const token = req.headers.get('x-zboxy-token');
  if (!token) return null;
  return db.zboxyUser.findUnique({ where: { token } });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, name } = await req.json();
    if (!id || !name) return NextResponse.json({ error: 'ID and name required' }, { status: 400 });

    const file = await db.zboxyFile.findUnique({ where: { id, userId: user.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // Update children paths if it's a folder
    if (file.type === 'folder') {
      const oldPrefix = file.path === '/' ? '/' + file.name : file.path + '/' + file.name;
      const newPrefix = file.path === '/' ? '/' + name : file.path + '/' + name;

      const children = await db.zboxyFile.findMany({
        where: { userId: user.id, path: { startsWith: oldPrefix } },
      });

      for (const child of children) {
        await db.zboxyFile.update({
          where: { id: child.id },
          data: { path: newPrefix + child.path.slice(oldPrefix.length) },
        });
      }
    }

    const updated = await db.zboxyFile.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
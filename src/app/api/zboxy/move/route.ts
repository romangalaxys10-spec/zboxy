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

    const { ids, targetPath } = await req.json();
    if (!ids || !targetPath) return NextResponse.json({ error: 'IDs and target path required' }, { status: 400 });

    for (const id of ids) {
      const file = await db.zboxyFile.findUnique({ where: { id, userId: user.id } });
      if (!file) continue;

      const oldPrefix = file.path === '/' ? '/' + file.name : file.path + '/' + file.name;
      const newPrefix = targetPath === '/' ? '/' + file.name : targetPath + '/' + file.name;

      // Move children if folder
      if (file.type === 'folder') {
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

      await db.zboxyFile.update({ where: { id }, data: { path: targetPath } });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
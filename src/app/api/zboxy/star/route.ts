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

    const { id, starred } = await req.json();
    if (!id) return NextResponse.json({ error: 'File ID required' }, { status: 400 });

    const file = await db.zboxyFile.findUnique({ where: { id, userId: user.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const updated = await db.zboxyFile.update({
      where: { id },
      data: { starred: starred !== undefined ? starred : !file.starred },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

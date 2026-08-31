import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-zboxy-token');
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    const user = await db.zboxyUser.findUnique({ where: { token } });
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    return NextResponse.json({ id: user.id, name: user.name, token: user.token });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
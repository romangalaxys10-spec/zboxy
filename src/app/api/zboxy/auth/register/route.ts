import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateToken, ensureUserDir } from '@/lib/zboxy';

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
      return NextResponse.json({ error: 'Name must be between 1 and 50 characters' }, { status: 400 });
    }
    const trimmed = name.trim();
    const token = generateToken();
    const user = await db.zboxyUser.create({
      data: { name: trimmed, token },
    });
    await ensureUserDir(user.id);
    return NextResponse.json({ id: user.id, name: user.name, token: user.token });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
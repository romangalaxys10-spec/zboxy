import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function getUser(req: NextRequest) {
  const token = req.headers.get('x-zboxy-token');
  if (!token) return null;
  return db.zboxyUser.findUnique({ where: { token } });
}

function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// GET /api/zboxy/share?fileId=xxx - list share links for a file
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fileId = req.nextUrl.searchParams.get('fileId');
    if (!fileId) return NextResponse.json({ error: 'File ID required' }, { status: 400 });

    // Verify file belongs to user
    const file = await db.zboxyFile.findUnique({ where: { id: fileId, userId: user.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const links = await db.zboxyShareLink.findMany({
      where: { fileId, userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(links);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/zboxy/share - create a share link
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileId, password, expiresInHours } = await req.json();
    if (!fileId) return NextResponse.json({ error: 'File ID required' }, { status: 400 });

    // Verify file belongs to user
    const file = await db.zboxyFile.findUnique({ where: { id: fileId, userId: user.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const token = generateShareToken();
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const link = await db.zboxyShareLink.create({
      data: {
        fileId,
        userId: user.id,
        token,
        password: password || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/zboxy/share?id=xxx - delete a share link
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Share link ID required' }, { status: 400 });

    const link = await db.zboxyShareLink.findUnique({ where: { id } });
    if (!link || link.userId !== user.id) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    await db.zboxyShareLink.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/zboxy/share - toggle enabled or update password
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, enabled, password } = await req.json();
    if (!id) return NextResponse.json({ error: 'Share link ID required' }, { status: 400 });

    const link = await db.zboxyShareLink.findUnique({ where: { id } });
    if (!link || link.userId !== user.id) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (enabled !== undefined) data.enabled = enabled;
    if (password !== undefined) data.password = password || null;

    const updated = await db.zboxyShareLink.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

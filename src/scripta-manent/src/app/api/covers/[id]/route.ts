import { NextRequest, NextResponse } from 'next/server';
import { initializeDBConnection } from '@/server/db/data-source';
import { BookCoverEntity } from '@/server/db/entities';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  // — Validate UUID format to avoid injection via raw SQL elsewhere —
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid cover id' }, { status: 400 });
  }

  try {
    const db   = await initializeDBConnection();
    const repo = db.getRepository(BookCoverEntity);

    const cover = await repo.findOne({ where: { id }, select: ['id', 'mimeType', 'data'] });

    if (!cover) {
      return NextResponse.json({ error: 'Cover not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(cover.data), {
      status: 200,
      headers: {
        'Content-Type':  cover.mimeType,
        // Immutable: the id is content-addressed (a UUID keyed to a specific binary),
        // so it never changes for the same id.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[covers/[id]] Failed to fetch cover:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

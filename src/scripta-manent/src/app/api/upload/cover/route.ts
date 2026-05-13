import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { randomUUID } from 'crypto';
import { initializeDBConnection } from '@/server/db/data-source';
import { BookCoverEntity } from '@/server/db/entities';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  // — Auth guard —
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // — Parse multipart form —
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  // — Validate MIME type —
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.type}. Accepted: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      },
      { status: 400 },
    );
  }

  // — Validate file size —
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum allowed size is 2 MB` },
      { status: 400 },
    );
  }

  // — Store binary in the database —
  let coverId: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const db     = await initializeDBConnection();
    const repo   = db.getRepository(BookCoverEntity);

    coverId = randomUUID();
    const cover = repo.create({
      id:       coverId,
      bookId:   null,          // orphan — linked when book is saved via tRPC
      mimeType: file.type,
      data:     buffer,
    });
    await repo.save(cover);
  } catch (err) {
    console.error('[upload/cover] Failed to store cover in database:', err);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  return NextResponse.json({ url: `/api/covers/${coverId}` }, { status: 200 });
}

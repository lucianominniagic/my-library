import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

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
  const ext = ALLOWED_MIME_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Accepted: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}` },
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

  // — Persist to public/covers/ —
  const coversDir = path.join(process.cwd(), 'public', 'covers');
  const filename = `${randomUUID()}.${ext}`;
  const filePath = path.join(coversDir, filename);

  try {
    fs.mkdirSync(coversDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.error('[upload/cover] Failed to write file:', err);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  return NextResponse.json({ url: `/covers/${filename}` }, { status: 200 });
}

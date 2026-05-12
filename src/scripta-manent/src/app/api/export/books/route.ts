import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDataSource } from '@/server/db/data-source';
import { BookEntity } from '@/server/db/entities/book.entity';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  const books = await ds.getRepository(BookEntity).find({
    where: { userId: session.user.id },
    relations: { bookAuthors: { author: true }, genres: true, tags: true },
    order: { title: 'ASC' },
  });

  // Colonne CSV
  const headers = [
    'title', 'titleEn', 'subtitle', 'authors', 'genres', 'tags',
    'isbn', 'publisher', 'publishedYear', 'pages', 'language',
    'yearRead', 'rating', 'notes', 'coverUrl', 'createdAt', 'updatedAt',
  ];

  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = books.map((b) =>
    [
      b.title,
      b.titleEn ?? '',
      b.subtitle ?? '',
      b.bookAuthors?.map((ba) => ba.author?.name).join('; ') ?? '',
      b.genres?.map((g) => g.name).join('; ') ?? '',
      b.tags?.map((t) => t.name).join('; ') ?? '',
      b.isbn ?? '',
      b.publisher ?? '',
      b.publishedYear ?? '',
      b.pages ?? '',
      b.language ?? '',
      b.yearRead ?? '',
      b.rating ?? '',
      b.notes ?? '',
      b.coverUrl ?? '',
      b.createdAt?.toISOString() ?? '',
      b.updatedAt?.toISOString() ?? '',
    ]
      .map(escape)
      .join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="scripta-manent.csv"',
    },
  });
}

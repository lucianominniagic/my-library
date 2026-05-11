export type AuthorDto = {
  id: string;
  name: string;
  nationality: string | null;
  role: string;
  sortOrder: number;
};

export type GenreDto = {
  id: string;
  name: string;
  slug: string;
};

export type TagDto = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

export type BookListItemDto = {
  id: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  yearRead: number | null;
  rating: number | null;
  authors: AuthorDto[];
  genres: GenreDto[];
  tags: TagDto[];
  createdAt: string; // ISO string
};

export type BookDetailDto = BookListItemDto & {
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  language: string;
  pages: number | null;
  description: string | null;
  notes: string | null;
  updatedAt: string;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
};

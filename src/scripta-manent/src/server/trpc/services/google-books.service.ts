/**
 * Fetch server-side della cover URL da Google Books API.
 * Waterfall: titleEn+author → titleIt+author → null.
 * Non lancia mai eccezioni: errori di rete o API → null.
 * Forza https:// (Google restituisce http://).
 *
 * Nota: nessuna dipendenza esterna — usa `fetch` nativo di Next.js.
 * Non esposto come tRPC endpoint — utility interna server-side.
 */

const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';
const TIMEOUT_MS = 5_000;

interface GoogleBooksResponse {
  totalItems: number;
  items?: Array<{
    volumeInfo?: {
      publisher?: string;
      publishedDate?: string;
      description?: string;
      pageCount?: number;
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }>;
}

/** Dati estratti da Google Books per arricchire un libro. */
export interface GoogleBooksVolumeData {
  coverUrl: string | null;
  publisher: string | null;
  publishedDate: string | null;
  description: string | null;
  pageCount: number | null;
}

/**
 * Recupera i dati completi di un volume tramite ISBN.
 * Non lancia mai: errori di rete o API → null.
 */
export async function fetchVolumeDataByIsbn(isbn: string): Promise<GoogleBooksVolumeData | null> {
  const url = `${GOOGLE_BOOKS_BASE}?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`;
  console.log('[google-books] fetchVolumeDataByIsbn:', url);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = (await response.json()) as GoogleBooksResponse;
    if (!data.totalItems || !data.items?.length) return null;
    const volumeInfo = data.items[0]?.volumeInfo;
    if (!volumeInfo) return null;

    const imageLinks = volumeInfo.imageLinks;
    const raw = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail ?? null;
    const coverUrl = raw ? raw.replace(/^http:\/\//, 'https://') : null;

    const result: GoogleBooksVolumeData = {
      coverUrl,
      publisher:     volumeInfo.publisher     ?? null,
      publishedDate: volumeInfo.publishedDate ?? null,
      description:   volumeInfo.description   ?? null,
      pageCount:     volumeInfo.pageCount      ?? null,
    };
    console.log('[google-books] fetchVolumeDataByIsbn result:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.warn('[google-books] fetchVolumeDataByIsbn fallito:', err);
    return null;
  }
}

function extractThumbnail(data: GoogleBooksResponse): string | null {
  if (!data.totalItems || !data.items?.length) return null;
  const imageLinks = data.items[0]?.volumeInfo?.imageLinks;
  const raw = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail ?? null;
  if (!raw) return null;
  // Google restituisce URL http:// — forziamo https://
  return raw.replace(/^http:\/\//, 'https://');
}

async function fetchByIsbn(isbn: string): Promise<string | null> {
  const url = `${GOOGLE_BOOKS_BASE}?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`;
  console.log('[google-books] Fetch by ISBN:', url);
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) return null;
  console.dir(await response.clone().json()); // Log completo per debug
  const data = (await response.json()) as GoogleBooksResponse;
  return extractThumbnail(data);
}

async function fetchThumbnail(title: string, authorName: string): Promise<string | null> {
  const q = `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(authorName)}`;
  const url = `${GOOGLE_BOOKS_BASE}?q=${q}&maxResults=1`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GoogleBooksResponse;
  return extractThumbnail(data);
}

/**
 * Waterfall:
 *  0. isbn                          (se fornito)
 *  1. titleEn + authorName          (se titleEn compilato)
 *  2. titleIt + authorName
 *  3. null
 *
 * Non lancia mai: qualsiasi errore → null + console.warn.
 */
export async function fetchCoverUrl(params: {
  titleEn?: string | null;
  titleIt: string;
  authorName: string;
  isbn?: string | null;
}): Promise<string | null> {
  const { titleEn, titleIt, authorName, isbn } = params;

  // Step 0: ricerca per ISBN (più precisa)
  if (isbn) {
    try {
      console.log('[google-books] Fetching cover by ISBN:', isbn);
      const cover = await fetchByIsbn(isbn);
      if (cover) return cover;
    } catch (err) {
      console.warn('[google-books] Fetch fallito (isbn):', err);
    }
  }

  // Step 1: titolo inglese (se disponibile)
  if (titleEn) {
    try {
      const cover = await fetchThumbnail(titleEn, authorName);
      if (cover) return cover;
    } catch (err) {
      console.warn('[google-books] Fetch fallito (titleEn):', err);
    }
  }

  // Step 2: titolo italiano
  try {
    const cover = await fetchThumbnail(titleIt, authorName);
    if (cover) return cover;
  } catch (err) {
    console.warn('[google-books] Fetch fallito (titleIt):', err);
  }

  return null;
}

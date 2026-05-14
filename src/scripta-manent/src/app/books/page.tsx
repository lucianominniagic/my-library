'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import { trpc } from '@/lib/trpc/client';
import { type BookDetailDto, type BookListItemDto } from '@/server/trpc/dto/book.dto';
import { BookList } from '@/components/books/BookList';
import { BookFormDialog } from '@/components/books/BookFormDialog';
import { DeleteConfirmDialog } from '@/components/books/DeleteConfirmDialog';
import { ActiveFilterChips } from '@/components/books/ActiveFilterChips';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a URL param as an integer, returning '' when absent/invalid */
function parseYear(raw: string | null): number | '' {
  if (!raw) return '';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton for loading state
// ─────────────────────────────────────────────────────────────────────────────

function BooksGridSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Skeleton variant="rectangular" sx={{ paddingTop: '150%', width: '100%' }} />
            <Box sx={{ p: 1.5 }}>
              <Skeleton width="80%" height={20} />
              <Skeleton width="60%" height={16} sx={{ mt: 0.5 }} />
              <Skeleton width="40%" height={16} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner component (needs Suspense boundary for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────

function BooksPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Read initial filters from URL ─────────────────────────────────────────
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(searchParams.get('q') ?? '');
  const [status, setStatus] = useState<'all' | 'read' | 'tbr'>(
    (searchParams.get('status') as 'all' | 'read' | 'tbr') ?? 'all',
  );
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    searchParams.get('genre') ? searchParams.get('genre')!.split(',').filter(Boolean) : [],
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    searchParams.get('tag') ? searchParams.get('tag')!.split(',').filter(Boolean) : [],
  );
  const [selectedYear, setSelectedYear] = useState<number | ''>(
    parseYear(searchParams.get('yearFrom')),
  );
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookDetailDto | undefined>(undefined);
  const [deletingBook, setDeletingBook] = useState<BookListItemDto | undefined>(undefined);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [q]);

  // ── Sync URL with filters ──────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (status !== 'all') params.set('status', status);
    if (selectedGenreIds.length > 0) params.set('genre', selectedGenreIds.join(','));
    if (selectedTagIds.length > 0) params.set('tag', selectedTagIds.join(','));
    if (status !== 'tbr' && selectedYear !== '') {
      params.set('yearFrom', String(selectedYear));
      params.set('yearTo', String(selectedYear));
    }
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [debouncedQ, status, selectedGenreIds, selectedTagIds, selectedYear, page, router, pathname]);

  // ── Genre & Tag options ────────────────────────────────────────────────────
  const { data: genreOptions = [] } = trpc.genre.list.useQuery();
  const { data: tagOptions = [] } = trpc.tag.list.useQuery();
  const { data: readYears = [] } = trpc.book.listReadYears.useQuery();

  // ── Books query ────────────────────────────────────────────────────────────
  const { data, isLoading } = trpc.book.list.useQuery({
    page,
    limit: 24,
    q: debouncedQ || undefined,
    status,
    genreIds: selectedGenreIds.length > 0 ? selectedGenreIds : undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    yearReadFrom: status !== 'tbr' && selectedYear !== '' ? selectedYear : undefined,
    yearReadTo: status !== 'tbr' && selectedYear !== '' ? selectedYear : undefined,
    sortBy: 'updatedAt',
    sortDir: 'desc',
  });

  // ── Stat queries for TBR/Read counter (REQ-61) ────────────────────────────
  const { data: readStats } = trpc.book.list.useQuery(
    { status: 'read', limit: 1, page: 1 },
    { staleTime: 60_000 },
  );
  const { data: tbrStats } = trpc.book.list.useQuery(
    { status: 'tbr', limit: 1, page: 1 },
    { staleTime: 60_000 },
  );

  // ── Book byId for edit ─────────────────────────────────────────────────────
  const [fetchingBookId, setFetchingBookId] = useState<string | null>(null);
  const { data: bookDetail } = trpc.book.byId.useQuery(
    { id: fetchingBookId! },
    { enabled: fetchingBookId != null },
  );

  useEffect(() => {
    if (bookDetail && fetchingBookId) {
      setEditingBook(bookDetail);
      setFormOpen(true);
      setFetchingBookId(null);
    }
  }, [bookDetail, fetchingBookId]);

  // ── Delete mutation ────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const deleteMutation = trpc.book.delete.useMutation({
    onSuccess: async () => {
      await utils.book.list.invalidate();
      setDeletingBook(undefined);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleEdit(bookId: string) {
    setFetchingBookId(bookId);
  }

  function handleDelete(bookId: string) {
    const book = data?.data.find((b) => b.id === bookId);
    if (book) setDeletingBook(book);
  }

  function handleStatusChange(_: unknown, newStatus: 'all' | 'read' | 'tbr' | null) {
    if (newStatus) {
      setStatus(newStatus);
      setPage(1);
      // Clear year filter when switching to 'tbr' — TBR books have no yearRead
      if (newStatus === 'tbr') {
        setSelectedYear('');
      }
    }
  }

  function handleOpenCreate() {
    setEditingBook(undefined);
    setFormOpen(true);
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditingBook(undefined);
  }

  function handleClearAllFilters() {
    setQ('');
    setDebouncedQ('');
    setSelectedGenreIds([]);
    setSelectedTagIds([]);
    setSelectedYear('');
    setPage(1);
  }

  const books = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: 2.5,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
            La mia libreria
          </Typography>
          {/* ── REQ-61: TBR / Read summary ─────────────────────────────── */}
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {readStats !== undefined && tbrStats !== undefined ? (
              <>
                📚 <strong>{readStats.total}</strong>&nbsp;letti
                &nbsp;·&nbsp;
                📋 <strong>{tbrStats.total}</strong>&nbsp;da leggere
              </>
            ) : (
              <Skeleton width={160} height={18} sx={{ display: 'inline-block' }} />
            )}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            href="/api/export/books"
            download
            startIcon={<DownloadIcon />}
          >
            Esporta CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
          >
            Aggiungi libro
          </Button>
        </Box>
      </Box>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca titolo o autore…"
          size="small"
          sx={{ minWidth: 220, flexGrow: 1, maxWidth: 400 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Status filter */}
        <ToggleButtonGroup
          value={status}
          exclusive
          onChange={handleStatusChange}
          size="small"
          aria-label="filtro stato"
        >
          <ToggleButton value="all">Tutti</ToggleButton>
          <ToggleButton value="read">Letti</ToggleButton>
          <ToggleButton value="tbr">Da leggere</ToggleButton>
        </ToggleButtonGroup>

        {/* Genre filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Genere</InputLabel>
          <Select
            multiple
            value={selectedGenreIds}
            onChange={(e) => {
              setSelectedGenreIds(e.target.value as string[]);
              setPage(1);
            }}
            label="Genere"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {(selected as string[]).map((id) => {
                  const genre = genreOptions.find((g) => g.id === id);
                  return genre ? (
                    <Chip key={id} label={genre.name} size="small" sx={{ height: 18, fontSize: '0.7rem' }} />
                  ) : null;
                })}
              </Box>
            )}
          >
            {genreOptions.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* REQ-12: Tag filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Tag</InputLabel>
          <Select
            multiple
            value={selectedTagIds}
            onChange={(e) => {
              setSelectedTagIds(e.target.value as string[]);
              setPage(1);
            }}
            label="Tag"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {(selected as string[]).map((id) => {
                  const tag = tagOptions.find((t) => t.id === id);
                  return tag ? (
                    <Chip key={id} label={`#${tag.name}`} size="small" sx={{ height: 18, fontSize: '0.7rem' }} />
                  ) : null;
                })}
              </Box>
            )}
          >
            {tagOptions.length === 0 ? (
              <MenuItem disabled>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Nessun tag disponibile
                </Typography>
              </MenuItem>
            ) : (
              tagOptions.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.color && (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: t.color,
                        mr: 1,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {t.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {/* Anno lettura — Select con anni dal DB (nascosto per TBR) */}
        {status !== 'tbr' && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Anno lettura</InputLabel>
            <Select
              value={selectedYear}
              label="Anno lettura"
              onChange={(e) => {
                const val = e.target.value;
                setSelectedYear(val as number | '');
                setPage(1);
              }}
            >
              <MenuItem value="">Tutti gli anni</MenuItem>
              {readYears.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* ── REQ-16: Active filter chips ───────────────────────────────────── */}
      <ActiveFilterChips
        q={debouncedQ}
        genreIds={selectedGenreIds}
        tagIds={selectedTagIds}
        selectedYear={status !== 'tbr' ? selectedYear : ''}
        genreOptions={genreOptions}
        tagOptions={tagOptions}
        onRemoveQ={() => {
          setQ('');
          setDebouncedQ('');
          setPage(1);
        }}
        onRemoveGenre={(id) => {
          setSelectedGenreIds((prev) => prev.filter((g) => g !== id));
          setPage(1);
        }}
        onRemoveTag={(id) => {
          setSelectedTagIds((prev) => prev.filter((t) => t !== id));
          setPage(1);
        }}
        onRemoveYear={() => { setSelectedYear(''); setPage(1); }}
        onClearAll={handleClearAllFilters}
      />

      {/* ── Count ────────────────────────────────────────────────────────── */}
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {isLoading ? (
          <CircularProgress size={12} sx={{ mr: 1 }} />
        ) : (
          `${total} ${total === 1 ? 'libro trovato' : 'libri trovati'}`
        )}
      </Typography>

      {/* ── Book list ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <BooksGridSkeleton />
      ) : (
        <BookList
          books={books}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            color="primary"
            shape="rounded"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <BookFormDialog
        open={formOpen}
        onClose={handleFormClose}
        book={editingBook}
      />

      {deletingBook && (
        <DeleteConfirmDialog
          open={!!deletingBook}
          onClose={() => setDeletingBook(undefined)}
          bookTitle={deletingBook.title}
          onConfirm={() => deleteMutation.mutate({ id: deletingBook.id })}
          isLoading={deleteMutation.isPending}
        />
      )}
    </Container>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported page — wraps with Suspense for useSearchParams
// ─────────────────────────────────────────────────────────────────────────────

export default function BooksPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <BooksGridSkeleton />
        </Container>
      }
    >
      <BooksPageInner />
    </Suspense>
  );
}

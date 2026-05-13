'use client';

import { useState, use, useEffect } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Image from 'next/image';
import { trpc } from '@/lib/trpc/client';
import { StarRating } from '@/components/books/StarRating';
import { BookFormDialog } from '@/components/books/BookFormDialog';
import { DeleteConfirmDialog } from '@/components/books/DeleteConfirmDialog';

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: book, isLoading, error } = trpc.book.byId.useQuery({ id });
  const utils = trpc.useUtils();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    setCoverError(false);
  }, [book?.coverUrl]);

  const deleteMutation = trpc.book.delete.useMutation({
    onSuccess: async () => {
      await utils.book.list.invalidate();
      router.push('/books');
    },
  });

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton width={160} height={36} sx={{ mb: 3 }} />
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Skeleton variant="rectangular" sx={{ paddingTop: '150%', borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 8, md: 9 }}>
            <Skeleton width="70%" height={44} />
            <Skeleton width="50%" height={28} sx={{ mt: 1 }} />
            <Skeleton width="40%" height={24} sx={{ mt: 2 }} />
            <Skeleton width="30%" height={24} sx={{ mt: 1 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !book) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button
          component={NextLink}
          href="/books"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 3 }}
        >
          Torna alla libreria
        </Button>
        <Typography color="error">
          {error?.message ?? 'Libro non trovato'}
        </Typography>
      </Container>
    );
  }

  const isRead = book.yearRead != null;
  const authorLabel = book.authors.map((a) => a.name).join(', ');
  const isDbCover = book.coverUrl?.startsWith('/api/covers/');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Back link */}
      <Button
        component={NextLink}
        href="/books"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Torna alla libreria
      </Button>

      {/* ── Main section ─────────────────────────────────────────────────── */}
      <Grid container spacing={4}>
        {/* Cover */}
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              paddingTop: '150%',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'grey.200',
            }}
          >
            {book.coverUrl && !coverError ? (
              <Image
                src={book.coverUrl}
                alt={`Copertina di ${book.title}`}
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 600px) 100vw, 300px"
                unoptimized={isDbCover}
                onError={() => setCoverError(true)}
              />
            ) : (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h2" sx={{ opacity: 0.4 }}>
                  📚
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        {/* Info */}
        <Grid size={{ xs: 12, sm: 8, md: 9 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            {book.title}
          </Typography>
          {book.subtitle && (
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400, mb: 1 }}>
              {book.subtitle}
            </Typography>
          )}

          {authorLabel && (
            <Typography variant="subtitle1" sx={{ color: 'text.secondary', mb: 2 }}>
              {authorLabel}
            </Typography>
          )}

          {/* Status + rating */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={isRead ? `Letto ${book.yearRead}` : 'Da leggere'}
              color={isRead ? 'success' : 'default'}
            />
            {isRead && book.rating != null && (
              <StarRating value={book.rating} size="medium" readonly />
            )}
          </Box>

          {/* Genres */}
          {book.genres.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
              {book.genres.map((g) => (
                <Chip key={g.id} label={g.name} size="small" variant="outlined" />
              ))}
            </Box>
          )}

          {/* Tags */}
          {book.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              {book.tags.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  size="small"
                  sx={{
                    bgcolor: t.color ?? undefined,
                    color: t.color ? 'white' : undefined,
                  }}
                />
              ))}
            </Box>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setFormOpen(true)}
            >
              Modifica
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteOpen(true)}
            >
              Elimina
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {book.notes && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Note
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', mb: 3 }}
          >
            {book.notes}
          </Typography>
          <Divider sx={{ mb: 3 }} />
        </>
      )}

      {/* ── Details ──────────────────────────────────────────────────────── */}
      {(book.isbn || book.publisher || book.publishedYear || book.pages || book.description || book.titleEn) && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Dettagli
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {book.titleEn && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Titolo in inglese
                </Typography>
                <Typography variant="body2">{book.titleEn}</Typography>
              </Grid>
            )}
            {book.isbn && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  ISBN
                </Typography>
                <Typography variant="body2">{book.isbn}</Typography>
              </Grid>
            )}
            {book.publisher && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Editore
                </Typography>
                <Typography variant="body2">{book.publisher}</Typography>
              </Grid>
            )}
            {book.publishedYear && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Anno pubblicazione
                </Typography>
                <Typography variant="body2">{book.publishedYear}</Typography>
              </Grid>
            )}
            {book.language && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Lingua
                </Typography>
                <Typography variant="body2">{book.language.toUpperCase()}</Typography>
              </Grid>
            )}
            {book.pages && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Pagine
                </Typography>
                <Typography variant="body2">{book.pages}</Typography>
              </Grid>
            )}
          </Grid>

          {book.description && (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Descrizione
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {book.description}
              </Typography>
            </>
          )}
        </>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <BookFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        book={book}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        bookTitle={book.title}
        onConfirm={() => deleteMutation.mutate({ id: book.id })}
        isLoading={deleteMutation.isPending}
      />
    </Container>
  );
}

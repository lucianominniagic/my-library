'use client';

import { Box, Card, CardActionArea, CardContent, Chip, Typography } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type BookListItemDto } from '@/server/trpc/dto/book.dto';
import { StarRating } from './StarRating';

// ─────────────────────────────────────────────────────────────────────────────
// Relevance chip helper
// ─────────────────────────────────────────────────────────────────────────────

function getRelevanceChip(score: number): { label: string; color: 'success' | 'warning' | 'default' } {
  if (score >= 0.3) return { label: `${Math.round(score * 100)}%`, color: 'success' };
  if (score >= 0.1) return { label: `${Math.round(score * 100)}%`, color: 'warning' };
  return { label: `${Math.round(score * 100)}%`, color: 'default' };
}

interface BookCardProps {
  book: BookListItemDto;
  onEdit: () => void;
  onDelete: () => void;
}

export function BookCard({ book, onEdit, onDelete }: BookCardProps) {
  const router = useRouter();
  const primaryAuthor = book.authors[0];
  const authorLabel = book.authors
    .map((a) => a.name)
    .join(', ');
  const isRead = book.yearRead != null;
  const visibleGenres = book.genres.slice(0, 2);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent card click when action buttons used from parent
    e.stopPropagation();
    router.push(`/books/${book.id}`);
  };

  void primaryAuthor; // used in authorLabel

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative', // needed for absolute relevance chip
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <CardActionArea
        onClick={handleClick}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Cover image — 2:3 aspect ratio */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            paddingTop: '150%', // 2:3 ratio
            bgcolor: 'grey.100',
            flexShrink: 0,
          }}
        >
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={`Copertina di ${book.title}`}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
            />
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.200',
              }}
            >
              <Typography variant="h3" sx={{ opacity: 0.5 }}>
                📚
              </Typography>
            </Box>
          )}
        </Box>

        {/* Card content */}
        <CardContent sx={{ flexGrow: 1, p: 1.5, pb: '12px !important' }}>
          {/* Title */}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 0.5,
              color: 'text.primary',
            }}
          >
            {book.title}
          </Typography>

          {/* Author */}
          {authorLabel && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mb: 0.75,
              }}
            >
              {authorLabel}
            </Typography>
          )}

          {/* Status badge + rating */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={isRead ? `Letto ${book.yearRead}` : 'Da leggere'}
              size="small"
              color={isRead ? 'success' : 'default'}
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
            {isRead && book.rating != null && (
              <StarRating value={book.rating} size="small" readonly />
            )}
          </Box>

          {/* Genres */}
          {visibleGenres.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {visibleGenres.map((g) => (
                <Chip
                  key={g.id}
                  label={g.name}
                  size="small"
                  variant="outlined"
                  sx={{ height: 16, fontSize: '0.6rem' }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* Relevance score chip — visible only during fulltext search */}
      {book.relevanceScore !== undefined && (() => {
        const chip = getRelevanceChip(book.relevanceScore!);
        return (
          <Chip
            size="small"
            label={chip.label}
            color={chip.color}
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              fontSize: '0.65rem',
              height: 20,
              pointerEvents: 'none', // let clicks pass through to CardActionArea
            }}
          />
        );
      })()}
    </Card>
  );
}

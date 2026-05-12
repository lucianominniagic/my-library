'use client';

import { Box, Button, Chip } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

interface GenreOption {
  id: string;
  name: string;
}

interface TagOption {
  id: string;
  name: string;
}

export interface ActiveFilterChipsProps {
  q: string;
  genreIds: string[];
  tagIds: string[];
  yearReadFrom: number | '';
  yearReadTo: number | '';
  genreOptions: GenreOption[];
  tagOptions: TagOption[];
  onRemoveQ: () => void;
  onRemoveGenre: (id: string) => void;
  onRemoveTag: (id: string) => void;
  onRemoveYearFrom: () => void;
  onRemoveYearTo: () => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({
  q,
  genreIds,
  tagIds,
  yearReadFrom,
  yearReadTo,
  genreOptions,
  tagOptions,
  onRemoveQ,
  onRemoveGenre,
  onRemoveTag,
  onRemoveYearFrom,
  onRemoveYearTo,
  onClearAll,
}: ActiveFilterChipsProps) {
  const hasFilters =
    !!q ||
    genreIds.length > 0 ||
    tagIds.length > 0 ||
    yearReadFrom !== '' ||
    yearReadTo !== '';

  if (!hasFilters) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        alignItems: 'center',
        mb: 2,
        px: 0.5,
      }}
      role="list"
      aria-label="Filtri attivi"
    >
      {/* Query chip */}
      {q && (
        <Chip
          role="listitem"
          label={`🔍 ${q}`}
          onDelete={onRemoveQ}
          size="small"
          aria-label={`Rimuovi ricerca: ${q}`}
        />
      )}

      {/* Genre chips */}
      {genreIds.map((id) => {
        const genre = genreOptions.find((g) => g.id === id);
        return genre ? (
          <Chip
            key={id}
            role="listitem"
            label={genre.name}
            onDelete={() => onRemoveGenre(id)}
            size="small"
            color="primary"
            variant="outlined"
            aria-label={`Rimuovi genere: ${genre.name}`}
          />
        ) : null;
      })}

      {/* Tag chips */}
      {tagIds.map((id) => {
        const tag = tagOptions.find((t) => t.id === id);
        return tag ? (
          <Chip
            key={id}
            role="listitem"
            label={`#${tag.name}`}
            onDelete={() => onRemoveTag(id)}
            size="small"
            color="secondary"
            variant="outlined"
            aria-label={`Rimuovi tag: ${tag.name}`}
          />
        ) : null;
      })}

      {/* Year range chips */}
      {yearReadFrom !== '' && (
        <Chip
          role="listitem"
          label={`Dal ${yearReadFrom}`}
          onDelete={onRemoveYearFrom}
          size="small"
          aria-label={`Rimuovi anno da: ${yearReadFrom}`}
        />
      )}
      {yearReadTo !== '' && (
        <Chip
          role="listitem"
          label={`Al ${yearReadTo}`}
          onDelete={onRemoveYearTo}
          size="small"
          aria-label={`Rimuovi anno a: ${yearReadTo}`}
        />
      )}

      {/* Clear all */}
      <Button
        size="small"
        onClick={onClearAll}
        startIcon={<ClearIcon fontSize="small" />}
        sx={{ ml: 'auto', fontSize: '0.75rem', color: 'text.secondary' }}
        aria-label="Cancella tutti i filtri"
      >
        Cancella tutti
      </Button>
    </Box>
  );
}

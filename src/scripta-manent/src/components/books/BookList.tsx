'use client';

import { Box, Grid, Typography } from '@mui/material';
import { type BookListItemDto } from '@/server/trpc/dto/book.dto';
import { BookCard } from './BookCard';

interface BookListProps {
  books: BookListItemDto[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BookList({ books, onEdit, onDelete }: BookListProps) {
  if (books.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 10,
          color: 'text.secondary',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1 }}>
          📚
        </Typography>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Nessun libro trovato
        </Typography>
        <Typography variant="body2">
          Prova a modificare i filtri o aggiungi un nuovo libro.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {books.map((book) => (
        <Grid key={book.id} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <BookCard
            book={book}
            onEdit={() => onEdit(book.id)}
            onDelete={() => onDelete(book.id)}
          />
        </Grid>
      ))}
    </Grid>
  );
}

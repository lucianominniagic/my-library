import { Box, Typography } from '@mui/material';

export default function BooksPage() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" color="primary.main">
        📚 Libreria
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        La lista dei tuoi libri apparirà qui (Fase 5)
      </Typography>
    </Box>
  );
}

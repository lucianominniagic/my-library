'use client';

import { Box, IconButton } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

interface StarRatingProps {
  value: number | null;
  size?: 'small' | 'medium';
  readonly?: boolean;
  onChange?: (v: number) => void;
}

export function StarRating({ value, size = 'small', readonly = true, onChange }: StarRatingProps) {
  const fontSize = size === 'small' ? 18 : 24;

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value != null && star <= value;
        const icon = filled ? (
          <StarIcon sx={{ fontSize, color: 'warning.main' }} />
        ) : (
          <StarBorderIcon sx={{ fontSize, color: 'action.disabled' }} />
        );

        if (readonly) {
          return (
            <Box key={star} sx={{ display: 'flex', alignItems: 'center' }}>
              {icon}
            </Box>
          );
        }

        return (
          <IconButton
            key={star}
            size="small"
            onClick={() => onChange?.(star)}
            sx={{ p: 0.25 }}
            aria-label={`Voto ${star}`}
          >
            {icon}
          </IconButton>
        );
      })}
    </Box>
  );
}

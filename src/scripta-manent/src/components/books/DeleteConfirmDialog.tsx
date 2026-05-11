'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  bookTitle: string;
  onConfirm: () => void;
  isLoading: boolean;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  bookTitle,
  onConfirm,
  isLoading,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Elimina libro</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Sei sicuro di voler eliminare <strong>&ldquo;{bookTitle}&rdquo;</strong>? L&apos;operazione non può essere annullata.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Annulla
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isLoading ? 'Eliminazione…' : 'Elimina'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

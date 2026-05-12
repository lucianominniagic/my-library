'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LabelIcon from '@mui/icons-material/Label';
import { trpc } from '@/lib/trpc/client';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
  '#92400E', // brown
];

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TagItem = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  bookCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function TagsPage() {
  const utils = trpc.useUtils();

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: tags = [], isLoading } = trpc.tag.list.useQuery();

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editingTag, setEditingTag]   = useState<TagItem | null>(null); // null = create
  const [tagName, setTagName]         = useState('');
  const [tagColor, setTagColor]       = useState('');
  const [nameError, setNameError]     = useState('');
  const [dialogApiError, setDialogApiError] = useState('');

  // ── Delete state ──────────────────────────────────────────────────────────
  const [deletingTag, setDeletingTag] = useState<TagItem | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = trpc.tag.create.useMutation({
    onSuccess: async () => {
      await utils.tag.list.invalidate();
      closeDialog();
    },
    onError: (err) => setDialogApiError(err.message),
  });

  const renameMutation = trpc.tag.rename.useMutation({
    onSuccess: async () => {
      await utils.tag.list.invalidate();
      closeDialog();
    },
    onError: (err) => setDialogApiError(err.message),
  });

  const deleteMutation = trpc.tag.delete.useMutation({
    onSuccess: async () => {
      await utils.tag.list.invalidate();
      setDeletingTag(null);
    },
  });

  const isPending = createMutation.isPending || renameMutation.isPending;

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openCreate() {
    setEditingTag(null);
    setTagName('');
    setTagColor('');
    setNameError('');
    setDialogApiError('');
    setDialogOpen(true);
  }

  function openRename(tag: TagItem) {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color ?? '');
    setNameError('');
    setDialogApiError('');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingTag(null);
    setTagName('');
    setTagColor('');
    setNameError('');
    setDialogApiError('');
  }

  function handleDialogSubmit() {
    const trimmedName = tagName.trim();
    if (!trimmedName) {
      setNameError('Il nome è obbligatorio');
      return;
    }
    setNameError('');
    setDialogApiError('');

    if (editingTag) {
      renameMutation.mutate({ id: editingTag.id, name: trimmedName });
    } else {
      createMutation.mutate({
        name: trimmedName,
        color: HEX_REGEX.test(tagColor) ? tagColor : undefined,
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
          Tag
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          Nuovo tag
        </Button>
      </Box>

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!isLoading && tags.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            color: 'text.secondary',
          }}
        >
          <LabelIcon sx={{ fontSize: 56, opacity: 0.3, mb: 1 }} />
          <Typography variant="h6" sx={{ opacity: 0.6 }}>
            Nessun tag ancora
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.5 }}>
            Crea il primo tag per organizzare i tuoi libri.
          </Typography>
        </Box>
      )}

      {/* ── Tag grid ───────────────────────────────────────────────────── */}
      {!isLoading && tags.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 2,
          }}
        >
          {(tags as TagItem[]).map((tag) => (
            <Card
              key={tag.id}
              variant="outlined"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                transition: 'box-shadow 0.15s',
                '&:hover': { boxShadow: 3 },
              }}
            >
              <CardContent sx={{ flex: 1, pb: '12px !important' }}>
                {/* Tag header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {/* Color dot */}
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: tag.color ?? 'text.disabled',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, flex: 1, wordBreak: 'break-word' }}
                  >
                    {tag.name}
                  </Typography>
                </Box>

                {/* Book count badge */}
                <Chip
                  label={`${tag.bookCount} ${tag.bookCount === 1 ? 'libro' : 'libri'}`}
                  size="small"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              </CardContent>

              {/* Actions */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  px: 1,
                  pb: 1,
                  gap: 0.5,
                }}
              >
                <Tooltip title="Rinomina">
                  <IconButton
                    size="small"
                    aria-label={`Rinomina tag ${tag.name}`}
                    onClick={() => openRename(tag)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Elimina">
                  <IconButton
                    size="small"
                    aria-label={`Elimina tag ${tag.name}`}
                    color="error"
                    onClick={() => setDeletingTag(tag)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {/* ── Create / Rename Dialog ─────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={isPending ? undefined : closeDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {editingTag ? `Rinomina "${editingTag.name}"` : 'Nuovo tag'}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
            {dialogApiError && (
              <Alert severity="error">{dialogApiError}</Alert>
            )}

            {/* Name field */}
            <TextField
              label="Nome tag *"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit(); }}
              error={!!nameError}
              helperText={nameError}
              autoFocus
              fullWidth
              slotProps={{ htmlInput: { maxLength: 50 } }}
            />

            {/* Color picker — only when creating */}
            {!editingTag && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Colore (opzionale)
                </Typography>

                {/* Preset swatches */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  {PRESET_COLORS.map((c) => (
                    <Box
                      key={c}
                      role="button"
                      tabIndex={0}
                      aria-label={`Colore ${c}`}
                      onClick={() => setTagColor(c)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTagColor(c); }}
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: c,
                        cursor: 'pointer',
                        outline: tagColor === c ? '3px solid' : '2px solid transparent',
                        outlineColor: tagColor === c ? 'text.primary' : 'transparent',
                        outlineOffset: 2,
                        transition: 'transform 0.1s',
                        '&:hover': { transform: 'scale(1.15)' },
                      }}
                    />
                  ))}
                  {/* "None" swatch */}
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label="Nessun colore"
                    onClick={() => setTagColor('')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTagColor(''); }}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '2px dashed',
                      borderColor: !tagColor ? 'text.primary' : 'divider',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      color: 'text.secondary',
                      transition: 'transform 0.1s',
                      '&:hover': { transform: 'scale(1.15)' },
                    }}
                  >
                    ✕
                  </Box>
                </Box>

                {/* Manual hex input */}
                <TextField
                  label="Colore hex"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  size="small"
                  placeholder="#3B82F6"
                  fullWidth
                  error={tagColor !== '' && !HEX_REGEX.test(tagColor)}
                  helperText={
                    tagColor !== '' && !HEX_REGEX.test(tagColor)
                      ? 'Formato non valido (es. #3B82F6)'
                      : ''
                  }
                  slotProps={{
                    input: {
                      startAdornment: HEX_REGEX.test(tagColor) ? (
                        <InputAdornment position="start">
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              bgcolor: tagColor,
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          />
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog} disabled={isPending}>
            Annulla
          </Button>
          <Button
            variant="contained"
            onClick={handleDialogSubmit}
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isPending ? 'Salvataggio…' : editingTag ? 'Rinomina' : 'Crea tag'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────── */}
      <Dialog
        open={deletingTag !== null}
        onClose={deleteMutation.isPending ? undefined : () => setDeletingTag(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Elimina tag</DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler eliminare il tag{' '}
            <strong>&ldquo;{deletingTag?.name}&rdquo;</strong>?
          </Typography>
          {deletingTag && deletingTag.bookCount > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Questo tag è associato a{' '}
              <strong>{deletingTag.bookCount}</strong>{' '}
              {deletingTag.bookCount === 1 ? 'libro' : 'libri'}.
              L&rsquo;eliminazione rimuoverà l&rsquo;associazione.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeletingTag(null)}
            disabled={deleteMutation.isPending}
          >
            Annulla
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deletingTag && deleteMutation.mutate({ id: deletingTag.id })}
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {deleteMutation.isPending ? 'Eliminazione…' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

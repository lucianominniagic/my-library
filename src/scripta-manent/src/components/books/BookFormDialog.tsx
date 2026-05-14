'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { trpc } from '@/lib/trpc/client';
import { type BookDetailDto, type CoverFetchResult, type GenreDto } from '@/server/trpc/dto/book.dto';
import { StarRating } from './StarRating';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AuthorRole = 'author' | 'editor' | 'translator' | 'illustrator' | 'other';

/** A real author result returned by the search API. */
type AuthorSearchOption = { id: string; name: string; nationality?: string | null; aliases?: string[] | null };
/** Sentinel option that renders a "Crea autore" entry at the bottom of the list. */
type CreateAuthorOption = { __type: 'create'; name: string };
type AuthorOption = AuthorSearchOption | CreateAuthorOption;

interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

const tagFilter = createFilterOptions<TagOption>();

interface SelectedAuthor {
  authorId: string;
  name: string;
  nationality: string | null;
  role: AuthorRole;
  sortOrder: number;
}

interface FormErrors {
  title?: string;
  authors?: string;
  yearRead?: string;
  coverUrl?: string;
}

interface BookFormDialogProps {
  open: boolean;
  onClose: () => void;
  book?: BookDetailDto;
}

const ROLE_LABELS: Record<AuthorRole, string> = {
  author: 'Autore',
  editor: 'Curatore',
  translator: 'Traduttore',
  illustrator: 'Illustratore',
  other: 'Altro',
};

const LANGUAGE_OPTIONS = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'Inglese' },
  { value: 'fr', label: 'Francese' },
  { value: 'de', label: 'Tedesco' },
  { value: 'es', label: 'Spagnolo' },
  { value: 'pt', label: 'Portoghese' },
  { value: 'ru', label: 'Russo' },
  { value: 'ja', label: 'Giapponese' },
  { value: 'zh', label: 'Cinese' },
  { value: 'ar', label: 'Arabo' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BookFormDialog({ open, onClose, book }: BookFormDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const utils = trpc.useUtils();
  const isEdit = book != null;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [yearRead, setYearRead] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<GenreDto[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
  const [tagInputValue, setTagInputValue] = useState('');
  // Advanced
  const [isbn, setIsbn] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publishedYear, setPublishedYear] = useState('');
  const [language, setLanguage] = useState('it');
  const [pages, setPages] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // ── Author search state ──────────────────────────────────────────────────────
  const [authorInput, setAuthorInput] = useState('');
  const [debouncedAuthorInput, setDebouncedAuthorInput] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAuthorInput(authorInput), 300);
    return () => clearTimeout(t);
  }, [authorInput]);

  const { data: authorResults, isFetching: authorsFetching } = trpc.author.search.useQuery(
    { q: debouncedAuthorInput, limit: 10 },
    { enabled: debouncedAuthorInput.trim().length >= 1 },
  );

  // ── Genre options ─────────────────────────────────────────────────────────
  const { data: genreOptions = [] } = trpc.genre.list.useQuery();

  // ── Tag options ───────────────────────────────────────────────────────────
  const { data: tagData = [] } = trpc.tag.list.useQuery();
  const allTags: TagOption[] = tagData.map((t) => ({ id: t.id, name: t.name, color: t.color }));

  const createTagMutation = trpc.tag.create.useMutation();

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = trpc.book.create.useMutation({
    onSuccess: async () => {
      await utils.book.list.invalidate();
      onClose();
    },
  });

  const updateMutation = trpc.book.update.useMutation({
    onSuccess: async (data) => {
      await utils.book.list.invalidate();
      await utils.book.byId.invalidate({ id: data.id });
      const result = data.coverFetchResult as CoverFetchResult | undefined;
      if (result === 'found' || result === 'not_found') {
        setCoverSnackbar({ open: true, result });
      }
      onClose();
    },
  });

  const createAuthorMutation = trpc.author.create.useMutation();

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error?.message ?? updateMutation.error?.message;

  // ── Errors ────────────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});

  // ── Cover upload state ────────────────────────────────────────────────────────
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drive a fake "fast-then-slow" progress animation while uploading
  useEffect(() => {
    if (uploadingCover) {
      setUploadProgress(0);
      uploadTimerRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          const next = prev + (85 - prev) * 0.06;
          return next >= 85 ? 85 : next;
        });
      }, 50);
    }
    return () => {
      if (uploadTimerRef.current) {
        clearInterval(uploadTimerRef.current);
        uploadTimerRef.current = null;
      }
    };
  }, [uploadingCover]);

  // ── Cover fetch snackbar state ────────────────────────────────────────────────
  const [coverSnackbar, setCoverSnackbar] = useState<{ open: boolean; result: 'found' | 'not_found' } | null>(null);

  // ── Pre-fill form when editing ────────────────────────────────────────────────
  useEffect(() => {
    if (open && book) {
      setTitle(book.title);
      setSubtitle(book.subtitle ?? '');
      setTitleEn(book.titleEn ?? '');
      setYearRead(book.yearRead != null ? String(book.yearRead) : '');
      setRating(book.rating);
      setNotes(book.notes ?? '');
      setIsbn(book.isbn ?? '');
      setPublisher(book.publisher ?? '');
      setPublishedYear(book.publishedYear != null ? String(book.publishedYear) : '');
      setLanguage(book.language ?? 'it');
      setPages(book.pages != null ? String(book.pages) : '');
      setDescription(book.description ?? '');
      setCoverUrl(book.coverUrl ?? null);
      setSelectedAuthors(
        book.authors.map((a) => ({
          authorId: a.id,
          name: a.name,
          nationality: a.nationality,
          role: a.role as AuthorRole,
          sortOrder: a.sortOrder,
        })),
      );
      setSelectedGenres(book.genres);
      setSelectedTags(book.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })));
      setCoverSnackbar(null);
    } else if (open && !book) {
      // Reset for create
      setTitle('');
      setSubtitle('');
      setTitleEn('');
      setYearRead('');
      setRating(null);
      setNotes('');
      setIsbn('');
      setPublisher('');
      setPublishedYear('');
      setLanguage('it');
      setPages('');
      setDescription('');
      setCoverUrl(null);
      setSelectedTags([]);
      setCoverSnackbar(null);
    }
    setErrors({});
    setUploadingCover(false);
    setUploadProgress(0);
    setAuthorInput('');
    setDebouncedAuthorInput('');
    setTagInputValue('');
  }, [open, book]);

  // ── Validation ────────────────────────────────────────────────────────────────
  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio';
    }
    if (selectedAuthors.length === 0) {
      newErrors.authors = 'Almeno un autore è richiesto';
    }
    if (yearRead.trim()) {
      const yr = Number(yearRead);
      if (!Number.isInteger(yr) || yr < 1800 || yr > 2200) {
        newErrors.yearRead = 'Anno non valido (1800–2200)';
      }
    }
    if (coverUrl?.trim()) {
      const val = coverUrl.trim();
      // Accept relative paths (e.g. /covers/uuid.jpg from the upload endpoint)
      // and reject strings that look like they should be full URLs but aren't.
      if (!val.startsWith('/')) {
        try {
          new URL(val);
        } catch {
          newErrors.coverUrl = 'URL non valido';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Cover upload ──────────────────────────────────────────────────────────────
  async function handleFileUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, coverUrl: 'File troppo grande (max 2MB)' }));
      return;
    }
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/cover', { method: 'POST', body: fd });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? 'Upload fallito');
      }
      const { url } = await res.json() as { url: string };
      setCoverUrl(url);
      setErrors((prev) => ({ ...prev, coverUrl: undefined }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, coverUrl: (err as Error).message }));
    } finally {
      // Stop the fake-progress timer, snap to 100%, then hide after 300 ms
      if (uploadTimerRef.current) {
        clearInterval(uploadTimerRef.current);
        uploadTimerRef.current = null;
      }
      setUploadProgress(100);
      setUploadingCover(false);
      setTimeout(() => setUploadProgress(0), 300);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;

    const authors = selectedAuthors.map((a, i) => ({
      authorId: a.authorId,
      role: a.role,
      sortOrder: i,
    }));
    const genreIds = selectedGenres.map((g) => g.id);
    const tagIds   = selectedTags.filter((t) => t.id !== '__new__').map((t) => t.id);

    if (isEdit && book) {
      // update: campo vuoto → null (cancella il valore nel DB)
      const yearReadNum = yearRead.trim() ? Number(yearRead) : null;
      updateMutation.mutate({
        id: book.id,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        titleEn: titleEn.trim() || null,
        isbn: isbn.trim() || null,
        publisher: publisher.trim() || null,
        publishedYear: publishedYear.trim() ? Number(publishedYear) : null,
        language,
        pages: pages.trim() ? Number(pages) : null,
        description: description.trim() || null,
        // null  = cover rimossa esplicitamente → invia null al backend
        // ''    = campo svuotato manualmente → undefined (non toccare)
        // stringa = URL valida → invia la stringa
        coverUrl: coverUrl === null ? null : (coverUrl?.trim() || undefined),
        yearRead: yearReadNum,
        rating: yearReadNum != null && rating != null ? rating : null,
        notes: notes.trim() || null,
        authors,
        genreIds,
        tagIds,
      });
    } else {
      // create: campo vuoto → undefined (il DB usa il default NULL, non inviare)
      const yearReadNum = yearRead.trim() ? Number(yearRead) : undefined;
      createMutation.mutate({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        titleEn: titleEn.trim() || undefined,
        isbn: isbn.trim() || undefined,
        publisher: publisher.trim() || undefined,
        publishedYear: publishedYear.trim() ? Number(publishedYear) : undefined,
        language,
        pages: pages.trim() ? Number(pages) : undefined,
        description: description.trim() || undefined,
        // BookCreateSchema non accetta null — se coverUrl è null (mai in create, ma per sicurezza) → undefined
        coverUrl: coverUrl === null ? undefined : (coverUrl?.trim() || undefined),
        yearRead: yearReadNum,
        rating: yearReadNum != null && rating != null ? rating : undefined,
        notes: notes.trim() || undefined,
        authors,
        genreIds,
        tagIds,
      });
    }
  }

  // ── Author helpers ────────────────────────────────────────────────────────────
  function addAuthor(author: { id: string; name: string; nationality: string | null }) {
    if (selectedAuthors.some((a) => a.authorId === author.id)) return;
    setSelectedAuthors((prev) => [
      ...prev,
      {
        authorId: author.id,
        name: author.name,
        nationality: author.nationality,
        role: 'author',
        sortOrder: prev.length,
      },
    ]);
    setAuthorInput('');
    setDebouncedAuthorInput('');
  }

  async function createAndAddAuthor(name: string) {
    try {
      const created = await createAuthorMutation.mutateAsync({ name: name.trim() });
      addAuthor(created);
    } catch {
      // Ignore: author creation error (might already exist)
    }
  }

  function removeAuthor(authorId: string) {
    setSelectedAuthors((prev) => prev.filter((a) => a.authorId !== authorId));
  }

  function updateAuthorRole(authorId: string, role: AuthorRole) {
    setSelectedAuthors((prev) =>
      prev.map((a) => (a.authorId === authorId ? { ...a, role } : a)),
    );
  }

  const yearReadNum = yearRead.trim() ? Number(yearRead) : NaN;
  const showRating = !isNaN(yearReadNum) && yearReadNum >= 1800 && yearReadNum <= 2200;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog
        open={open}
        onClose={isPending ? undefined : onClose}
        fullScreen={fullScreen}
        maxWidth="md"
        fullWidth
      >
      <DialogTitle>{isEdit ? 'Modifica libro' : 'Aggiungi libro'}</DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Error alert */}
          {mutationError && (
            <Alert severity="error">{mutationError}</Alert>
          )}

          {/* ── Titolo ──────────────────────────────────────────────────────── */}
          <TextField
            label="Titolo *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            fullWidth
            autoFocus={!isEdit}
          />

          {/* ── Sottotitolo ──────────────────────────────────────────────────── */}
          <TextField
            label="Sottotitolo"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            fullWidth
          />

          {/* ── Titolo in inglese ─────────────────────────────────────────────── */}
          <TextField
            label="Titolo in inglese (per ricerca copertina)"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            fullWidth
            size="small"
            helperText="Aiuta a trovare la copertina su Google Books"
          />

          {/* ── Autori ───────────────────────────────────────────────────────── */}
          <Box>
            <Autocomplete<AuthorOption, false, false, true>
              freeSolo
              inputValue={authorInput}
              onInputChange={(_, value) => setAuthorInput(value)}
              options={
                // Append the "Crea autore" sentinel whenever the user has typed something.
                // Server-side search already filters results, so we skip client-side filtering
                // and just pass options through unchanged.
                [
                  ...(authorResults ?? []) as AuthorSearchOption[],
                  ...(debouncedAuthorInput.trim().length >= 1
                    ? [{ __type: 'create' as const, name: debouncedAuthorInput }]
                    : []),
                ] as AuthorOption[]
              }
              // Bypass MUI's built-in client-side filter — results come from the server
              // and we always want the sentinel to survive.
              filterOptions={(options) => options}
              getOptionLabel={(opt) => {
                if (typeof opt === 'string') return opt;
                return opt.name;
              }}
              renderOption={(props, option) => {
                if (typeof option === 'string') {
                  return <li {...props} key="__freesolo__">{option}</li>;
                }
                if ('__type' in option && option.__type === 'create') {
                  return (
                    <li {...props} key="__create__">
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                        + Crea autore &ldquo;{option.name}&rdquo;
                      </Typography>
                    </li>
                  );
                }
                // At this point option is AuthorSearchOption; cast to satisfy TS narrowing
                const searchOpt = option as AuthorSearchOption;
                return (
                  <li {...props} key={searchOpt.id}>
                    <Box>
                      <Typography variant="body2">{searchOpt.name}</Typography>
                      {searchOpt.nationality && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {searchOpt.nationality}
                        </Typography>
                      )}
                    </Box>
                  </li>
                );
              }}
              loading={authorsFetching}
              renderInput={({ ...params }) => (
                <TextField
                  {...params}
                  label="Cerca autore"
                  error={!!errors.authors}
                  helperText={errors.authors ?? 'Cerca e seleziona un autore'}
                />
              )}
              onChange={(_, value) => {
                if (!value) return;
                // freeSolo: user pressed Enter on raw typed text
                if (typeof value === 'string') {
                  if (value.trim()) createAndAddAuthor(value.trim());
                  return;
                }
                // Sentinel "Crea autore" option selected
                if ('__type' in value && value.__type === 'create') {
                  createAndAddAuthor(value.name);
                  return;
                }
                // Normal author result selected; normalise nationality (undefined → null) to satisfy addAuthor's signature
                const searchOpt = value as AuthorSearchOption;
                addAuthor({ ...searchOpt, nationality: searchOpt.nationality ?? null });
              }}
              noOptionsText="Nessun risultato"
            />

            {/* Selected author chips */}
            {selectedAuthors.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {selectedAuthors.map((a) => (
                  <Box
                    key={a.authorId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      pl: 1,
                      pr: 0.5,
                      py: 0.25,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Typography variant="body2">{a.name}</Typography>
                    <Select
                      value={a.role}
                      onChange={(e) => updateAuthorRole(a.authorId, e.target.value as AuthorRole)}
                      size="small"
                      variant="standard"
                      disableUnderline
                      sx={{ fontSize: '0.75rem', minWidth: 90, ml: 0.5 }}
                    >
                      {(Object.keys(ROLE_LABELS) as AuthorRole[]).map((role) => (
                        <MenuItem key={role} value={role} sx={{ fontSize: '0.8rem' }}>
                          {ROLE_LABELS[role]}
                        </MenuItem>
                      ))}
                    </Select>
                    <Chip
                      size="small"
                      label="×"
                      onClick={() => removeAuthor(a.authorId)}
                      sx={{ height: 20, cursor: 'pointer', '& .MuiChip-label': { px: 0.75 } }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* ── Generi ───────────────────────────────────────────────────────── */}
          <Autocomplete
            multiple
            options={genreOptions}
            value={selectedGenres}
            onChange={(_, value) => setSelectedGenres(value)}
            getOptionLabel={(opt) => opt.name}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            renderInput={({ ...params }) => (
              <TextField
                {...params}
                label="Generi"
              />
            )}
          />

          {/* ── Tag ──────────────────────────────────────────────────────────── */}
          <Autocomplete
            multiple
            options={allTags}
            value={selectedTags}
            inputValue={tagInputValue}
            onInputChange={(_, value) => setTagInputValue(value)}
            onChange={async (_, newValue) => {
              const newTagOpt = newValue.find((t) => t.id === '__new__');
              if (!newTagOpt) {
                setSelectedTags(newValue);
                return;
              }
              // Inline tag creation
              const realName = tagInputValue.trim();
              if (!realName) {
                setSelectedTags(newValue.filter((t) => t.id !== '__new__'));
                return;
              }
              try {
                const created = await createTagMutation.mutateAsync({ name: realName });
                await utils.tag.list.invalidate();
                setSelectedTags([
                  ...newValue.filter((t) => t.id !== '__new__'),
                  { id: created.id, name: created.name, color: created.color },
                ]);
              } catch {
                // Creation failed: just drop the __new__ option
                setSelectedTags(newValue.filter((t) => t.id !== '__new__'));
              }
            }}
            getOptionLabel={(opt) => opt.name}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            filterOptions={(options, params) => {
              const filtered = tagFilter(options, params);
              if (
                params.inputValue !== '' &&
                !options.find((o) => o.name.toLowerCase() === params.inputValue.toLowerCase())
              ) {
                filtered.push({
                  id: '__new__',
                  name: `Crea "${params.inputValue}"`,
                  color: null,
                });
              }
              return filtered;
            }}
            renderValue={(value, getItemProps) => {
              const items = value as TagOption[];
              // MUI v9: getItemProps replaces getTagProps
              const getProps = getItemProps as (args: { index: number }) => {
                key: number;
                className: string;
                disabled: boolean;
                'data-item-index': number;
                tabIndex: -1;
                onDelete: (event: React.SyntheticEvent) => void;
              };
              return items.map((tag, index) => {
                const { key, ...itemProps } = getProps({ index });
                return (
                  <Chip
                    key={key}
                    label={tag.name}
                    size="small"
                    style={
                      tag.color
                        ? { backgroundColor: tag.color, color: '#fff' }
                        : undefined
                    }
                    {...itemProps}
                  />
                );
              });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tag"
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        {createTagMutation.isPending && (
                          <CircularProgress size={16} sx={{ mr: 0.5 }} />
                        )}
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />

          {/* ── Anno lettura + Rating ─────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Anno lettura"
              type="number"
              value={yearRead}
              onChange={(e) => {
                setYearRead(e.target.value);
                if (!e.target.value) setRating(null);
              }}
              error={!!errors.yearRead}
              helperText={errors.yearRead ?? 'Lascia vuoto per "Da leggere"'}
              sx={{ width: 200 }}
              slotProps={{ htmlInput: { min: 1800, max: 2200 } }}
            />

            {showRating && (
              <Box>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                  Voto
                </Typography>
                <StarRating value={rating} size="medium" readonly={false} onChange={setRating} />
              </Box>
            )}
          </Box>

          {/* ── Note ─────────────────────────────────────────────────────────── */}
          <TextField
            label="Note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />

          {/* ── Dettagli avanzati ─────────────────────────────────────────────── */}
          <Divider />
          <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Dettagli avanzati
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="ISBN"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    sx={{ flex: 1, minWidth: 150 }}
                  />
                  <TextField
                    label="Editore"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    sx={{ flex: 2, minWidth: 150 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="Anno pubblicazione"
                    type="number"
                    value={publishedYear}
                    onChange={(e) => setPublishedYear(e.target.value)}
                    slotProps={{ htmlInput: { min: 0, max: 2200 } }}
                    sx={{ width: 180 }}
                  />
                  <TextField
                    label="Pagine"
                    type="number"
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                    slotProps={{ htmlInput: { min: 1 } }}
                    sx={{ width: 120 }}
                  />
                  <FormControl sx={{ width: 160 }}>
                    <InputLabel>Lingua</InputLabel>
                    <Select
                      value={language}
                      label="Lingua"
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <MenuItem key={l.value} value={l.value}>
                          {l.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <TextField
                  label="Descrizione"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                />

                {/* ── Copertina ────────────────────────────────────────────────── */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* Preview thumbnail + action buttons */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {/* Thumbnail / placeholder */}
                    <Box
                      sx={{
                        width: 60,
                        height: 80,
                        borderRadius: 1,
                        overflow: 'hidden',
                        flexShrink: 0,
                        bgcolor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt="Copertina"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <Typography sx={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">
                          📚
                        </Typography>
                      )}
                    </Box>

                    {/* Upload button */}
                    <Button
                      variant="outlined"
                      size="small"
                      component="label"
                      disabled={uploadingCover}
                      startIcon={uploadingCover ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      {uploadingCover ? 'Caricamento…' : 'Carica immagine'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleFileUpload(file);
                          // reset so re-selecting the same file fires onChange again
                          e.target.value = '';
                        }}
                      />
                    </Button>

                    {/* Remove button — only when there's a cover */}
                    {coverUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        disabled={uploadingCover}
                        onClick={() => setCoverUrl(null)}
                      >
                        ❌ Rimuovi
                      </Button>
                    )}
                  </Box>

                  {/* Upload progress bar — visible during upload and 300 ms completion flash */}
                  {uploadProgress > 0 && (
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress}
                      color="primary"
                      sx={{ borderRadius: 1, width: '100%' }}
                    />
                  )}

                  {/* URL text field — still allows manual paste */}
                  <TextField
                    label="URL copertina"
                    value={coverUrl ?? ''}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    fullWidth
                    size="small"
                    error={!!errors.coverUrl}
                    helperText={errors.coverUrl}
                    placeholder="https://…"
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Form helper text for required fields */}
          <FormHelperText>* Campi obbligatori</FormHelperText>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Aggiungi libro'}
        </Button>
      </DialogActions>
      </Dialog>

      <Snackbar
        open={coverSnackbar?.open ?? false}
        autoHideDuration={4000}
        onClose={() => setCoverSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={coverSnackbar?.result === 'found' ? 'success' : 'warning'}
          onClose={() => setCoverSnackbar(null)}
          variant="filled"
        >
          {coverSnackbar?.result === 'found'
            ? '✅ Copertina trovata su Google Books'
            : '⚠️ Nessuna copertina trovata su Google Books'}
        </Alert>
      </Snackbar>
    </>
  );
}

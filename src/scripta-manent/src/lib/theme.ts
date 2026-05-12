'use client';

import { createTheme } from '@mui/material/styles';

// ─── shared overrides ─────────────────────────────────────────────────────────
const sharedComponents = {
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none' as const,
        fontWeight: 600,
      },
    },
  },
};

const sharedTypography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontWeight: 700 },
  h2: { fontWeight: 600 },
};

const sharedShape = { borderRadius: 8 };

// ─── Light theme ──────────────────────────────────────────────────────────────
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#3D2B1F' },
    secondary:  { main: '#8B5E3C' },
    background: { default: '#FAF7F2', paper: '#FFFFFF' },
    text:       { primary: '#1A0F0A', secondary: '#5C3D2E' },
  },
  typography: sharedTypography,
  shape:      sharedShape,
  components: {
    ...sharedComponents,
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#FAF7F2' },
      },
    },
  },
});

// ─── Dark theme ───────────────────────────────────────────────────────────────
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#C8956A' },
    secondary:  { main: '#A0714F' },
    background: { default: '#1A1410', paper: '#2C2018' },
    text:       { primary: '#F5EDE3', secondary: '#C8956A' },
  },
  typography: sharedTypography,
  shape:      sharedShape,
  components: {
    ...sharedComponents,
  },
});

// ─── Backward-compat default export ──────────────────────────────────────────
export const theme = lightTheme;

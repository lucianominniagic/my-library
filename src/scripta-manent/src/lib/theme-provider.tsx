'use client';

// NOTE: @mui/material-nextjs is not installed.
// Using plain ThemeProvider — functional but without Emotion SSR cache optimisation.
// To upgrade: install @mui/material-nextjs and wrap with AppRouterCacheProvider.
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

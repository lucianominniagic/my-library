'use client';

// NOTE: @mui/material-nextjs is not installed.
// Using plain ThemeProvider — functional but without Emotion SSR cache optimisation.
// To upgrade: install @mui/material-nextjs and wrap with AppRouterCacheProvider.
import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { lightTheme, darkTheme } from './theme';

// ─── Theme context ─────────────────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  toggleTheme: () => {},
});

/** Hook to read current mode and toggle it. */
export function useThemeMode(): ThemeContextValue {
  return useContext(ThemeContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with 'light' on the server to avoid hydration mismatch;
  // read localStorage after first paint.
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') {
      setMode(saved);
    }
  }, []);

  function toggleTheme() {
    setMode((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  }

  const muiTheme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

import type { Metadata } from 'next';
import { ThemeProvider } from '@/lib/theme-provider';
import { TRPCProvider } from '@/lib/trpc/provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scripta Manent',
  description: 'Catalogo personale di libri',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <ThemeProvider>
          <TRPCProvider>
            {children}
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

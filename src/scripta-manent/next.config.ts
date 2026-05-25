import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeORM usa require() dinamici (driver per tutti i DB) che webpack non
  // riesce a bundlare correttamente. Escludiamo TypeORM dal bundle webpack
  // e lo lasciamo caricare direttamente da Node.js, garantendo un singleton
  // unico e la corretta registrazione dei decoratori/metadata.
  serverExternalPackages: ['typeorm', 'pg', 'pg-native', 'reflect-metadata'],

  // Disabilita la minificazione server-side per rendere affidabile la
  // risoluzione dei decorator TypeORM. Con la minificazione attiva,
  // i nomi delle classi vengono mangled (es. BookEntity → s) e TypeORM
  // non riesce a trovare i metadata registrati → EntityMetadataNotFoundError.
  experimental: {
    serverMinification: false,
  },

  transpilePackages: [
    "@mui/material",
    "@mui/icons-material",
    "@mui/x-data-grid",
    "@mui/x-date-pickers",
    "@emotion/react",
    "@emotion/styled",
  ],
  images: {
    remotePatterns: [
      // Allow any https host — needed for user-provided cover URLs
      // (Google Books, Amazon, Goodreads, etc.)
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'books.google.com',
      },
    ],
  },
};

export default nextConfig;

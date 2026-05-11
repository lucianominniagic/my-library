import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeORM usa require() dinamici (driver per tutti i DB) che webpack non
  // riesce a bundlare correttamente. Escludiamo TypeORM dal bundle webpack
  // e lo lasciamo caricare direttamente da Node.js, garantendo un singleton
  // unico e la corretta registrazione dei decoratori/metadata.
  serverExternalPackages: ['typeorm', 'pg', 'pg-native', 'reflect-metadata'],

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
      {
        protocol: 'https',
        hostname: 'books.google.com',
      },
      {
        protocol: 'http',
        hostname: 'books.google.com',
      },
    ],
  },
};

export default nextConfig;

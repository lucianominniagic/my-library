export { auth as proxy } from '@/auth';

export const config = {
  matcher: [
    /*
     * Protegge tutte le route eccetto:
     * - /api/auth/* → next-auth handlers
     * - /login      → pagina di login
     * - /_next/*    → asset statici Next.js
     * - /favicon.ico
     */
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)',
  ],
};

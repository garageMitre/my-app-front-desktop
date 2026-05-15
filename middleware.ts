import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register'];
const DEFAULT_REDIRECT = '/dashboard';

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isPublicRoute = PUBLIC_ROUTES.includes(nextUrl.pathname);

  // Si el refresh token falló, forzar re-login
  if (session?.error === 'RefreshTokenError') {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // Sin sesión en ruta protegida → login
  if (!session && !isPublicRoute) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Con sesión en ruta pública → dashboard
  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo-icon\\.png|.*\\.[a-zA-Z0-9]+$).*)'],
};

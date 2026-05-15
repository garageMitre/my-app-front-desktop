import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    error?: string;
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }

  interface User {
    role: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    error?: string;
  }
}

import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const config: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API}/auth/sign-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          return {
            id: data.user.id,
            name: `${data.user.firstName} ${data.user.lastName}`,
            email: data.user.email,
            role: data.user.role,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_at,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Primer login: copiar datos del usuario al token
      if (user) {
        token.id          = user.id;
        token.role        = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken= user.refreshToken;
        token.expiresAt   = user.expiresAt;
      }

      // Si el access token expiró, hacer refresh
      if (token.expiresAt && Date.now() > new Date(token.expiresAt as string).getTime()) {
        try {
          const res = await fetch(`${API}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: token.refreshToken }),
          });

          if (res.ok) {
            const data = await res.json();
            token.accessToken = data.access_token;
            token.expiresAt   = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            token.error       = undefined;
          } else {
            token.error = 'RefreshTokenError';
          }
        } catch {
          token.error = 'RefreshTokenError';
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id    = token.id as string;
      session.user.role  = token.role as string;
      session.accessToken  = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.expiresAt    = token.expiresAt as string;
      session.error        = token.error as string | undefined;
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },

  session: { strategy: 'jwt' },

  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

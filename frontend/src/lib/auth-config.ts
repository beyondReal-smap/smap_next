import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import resolveBackendBaseUrl from '@/app/api/_utils/backend';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        const backendBase = resolveBackendBaseUrl();
        const response = await fetch(`${backendBase}/api/v1/members/google-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            google_id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            access_token: account?.access_token,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success && data.data?.token) {
          user.backendData = data.data;
          return true;
        }

        const errorMessage = data.message || '로그인에 실패했습니다.';
        throw new Error(errorMessage);
      } catch (error) {
        console.error('Google 로그인 처리 중 오류:', error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user?.backendData) {
        token.backendData = user.backendData;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.backendData) {
        session.backendData = token.backendData;
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  session: {
    strategy: 'jwt',
  },
};

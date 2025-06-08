import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('Google 로그인 시도:', { user, account, profile });
      
      try {
        // 백엔드 API에 Google 사용자 정보 전송
        const response = await fetch('https://118.67.130.71:8000/api/v1/members/google-login', {
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
        console.log('백엔드 Google 로그인 응답:', data);

        if (response.ok && data.success) {
          // 사용자 정보를 세션에 추가
          user.backendData = data.data;
          return true;
        } else {
          console.error('백엔드 Google 로그인 실패:', data);
          return false;
        }
      } catch (error) {
        console.error('Google 로그인 처리 중 오류:', error);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      // JWT 토큰에 백엔드 데이터 추가
      if (user?.backendData) {
        token.backendData = user.backendData;
      }
      return token;
    },
    async session({ session, token }) {
      // 세션에 백엔드 데이터 추가
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
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 
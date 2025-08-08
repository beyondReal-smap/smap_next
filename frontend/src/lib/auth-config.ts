import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { generateJWT } from './auth'

export const authOptions: NextAuthOptions = {
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
        // SSL 검증 우회 설정
        const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        
        try {
          // 백엔드 API에 Google 사용자 정보 전송
          const response = await fetch('https://api3.smap.site/api/v1/members/google-login', {
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
            // JWT 토큰 생성
            const jwtToken = generateJWT({
              mt_idx: data.data.member.mt_idx,
              mt_id: data.data.member.mt_id,
              mt_name: data.data.member.mt_name,
              mt_nickname: data.data.member.mt_nickname,
              mt_file1: data.data.member.mt_file1,
            });
            
            console.log('[NEXTAUTH] JWT 토큰 생성 완료, 길이:', jwtToken.length);
            console.log('[NEXTAUTH] JWT 토큰 시작 부분:', jwtToken.substring(0, 50) + '...');
            
            // 사용자 정보를 세션에 추가 (JWT 토큰 포함)
            user.backendData = {
              ...data.data,
              token: jwtToken // 실제 JWT 토큰으로 교체
            };
            return true;
          } else {
            console.error('백엔드 Google 로그인 실패:', data);
            // 에러 메시지를 URL 파라미터로 전달
            const errorMessage = data.message || '로그인에 실패했습니다.';
            throw new Error(errorMessage);
          }
        } finally {
          // 환경 변수 복원
          if (originalTlsReject !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
          } else {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
          }
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
    async redirect({ url, baseUrl }) {
      // 로그인 성공 후에만 home으로 리다이렉트
      console.log('[NEXTAUTH] 리다이렉트:', { url, baseUrl });
      
      // 로그인 성공 후 callbackUrl이 /home인 경우에만 리다이렉트
      if (url === `${baseUrl}/home` || url === '/home') {
        return `${baseUrl}/home`;
      }
      
      // 기본적으로는 요청된 URL로 이동
      if (url.startsWith('/') || url.startsWith(baseUrl)) {
        return url;
      }
      
      return baseUrl;
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
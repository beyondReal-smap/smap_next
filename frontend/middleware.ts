import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 인증이 필요하지 않은 공개 경로들
const publicPaths = [
  '/signin',
  '/register',
  '/login',
  '/social-login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/images',
  '/icons'
];

// API 경로들 (별도 처리)
const apiPaths = ['/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log('[MIDDLEWARE] 요청 경로:', pathname);
  
  // 공개 경로는 통과
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log('[MIDDLEWARE] 공개 경로 통과:', pathname);
    return NextResponse.next();
  }

  // API 경로는 별도 처리 (API 자체에서 인증 처리)
  if (apiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 쿠키에서 JWT 토큰 확인
  const token = request.cookies.get('token')?.value;
  
  console.log('[MIDDLEWARE] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
  
  // 토큰이 없으면 signin 페이지로 리다이렉트
  if (!token) {
    console.log('[MIDDLEWARE] 토큰 없음, signin으로 리다이렉트:', pathname);
    const signinUrl = new URL('/signin', request.url);
    signinUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signinUrl);
  }

  // 토큰 유효성 검증 (간단한 형태 체크)
  try {
    // JWT 토큰 형태 체크 (Bearer 토큰이 아닌 경우)
    if (!token.includes('.')) {
      throw new Error('Invalid token format');
    }

    // 토큰이 있으면 계속 진행
    return NextResponse.next();
  } catch (error) {
    // 토큰이 유효하지 않으면 signin 페이지로 리다이렉트
    const signinUrl = new URL('/signin', request.url);
    signinUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signinUrl);
  }
}

// middleware가 실행될 경로 설정
export const config = {
  matcher: [
    /*
     * 다음 경로들을 제외한 모든 경로에서 실행:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public 폴더의 파일들
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|icons).*)',
  ],
}; 
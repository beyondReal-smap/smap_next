import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 인증이 필요하지 않은 공개 경로들
// 첫 진입( '/')과 인증 콜백('/auth')을 명시적으로 허용하여
// 초기 로드 시 SSR 리다이렉트로 인한 인증 실패 UX를 방지
const publicPaths = [
  '/auth',
  '/signin',
  '/register',
  '/register-new',
  '/login',
  '/social-login',
  '/forgot-password',
  '/reset-password',
  '/r',
  '/account-deletion',
  '/legal',
  '/privacy',
  '/offline',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/images',
  '/icons'
];

// 그룹 가입 페이지 패턴 (정규표현식)
const isGroupJoinPath = (pathname: string): boolean => {
  const isJoinPath = /^\/group\/\d+\/join/.test(pathname);
  console.log('[MIDDLEWARE] isGroupJoinPath 체크:', { pathname, isJoinPath });
  return isJoinPath;
};

// Vercel 환경에서 클라이언트 사이드 인증으로 처리할 경로들
const clientAuthPaths = [
  '/home',
  '/group',
  '/schedule',
  '/location',
  '/logs',
  '/members',
  '/notice',
  '/setting'
];

// API 경로들 (별도 처리)
const apiPaths = ['/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 루트 경로("/")는 항상 통과 (클라이언트에서 라우팅 처리)
  if (pathname === '/') {
    console.log('[MIDDLEWARE] 🟢 루트 경로 통과: /');
    return NextResponse.next();
  }

  // 공개 경로는 항상 통과
  if (
    publicPaths.some(path => pathname === path || pathname.startsWith(`${path}/`)) ||
    isGroupJoinPath(pathname)
  ) {
    return NextResponse.next();
  }

  // API 경로는 자체 인증 처리
  if (apiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 인증 토큰 확인 (Vercel과 로컬 공통)
  const authToken = request.cookies.get('auth-token')?.value;

  console.log(`[MIDDLEWARE] 경로: ${pathname}, 토큰 존재: ${!!authToken}`);

  // 보호된 경로에 접근하는데 토큰이 없는 경우
  if (!authToken) {
    console.log('[MIDDLEWARE] 🛑 토큰 없음, /signin으로 리디렉션:', pathname);
    const signinUrl = new URL('/signin', request.url);
    signinUrl.searchParams.set('redirect', pathname); // 원래 가려던 경로를 파라미터로 추가
    return NextResponse.redirect(signinUrl);
  }

  // 토큰이 있는 경우, 요청 계속 진행
  console.log('[MIDDLEWARE] ✅ 토큰 있음, 접근 허용:', pathname);
  return NextResponse.next();
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
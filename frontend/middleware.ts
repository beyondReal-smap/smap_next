import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 공개 경로 (인증 없이 접근 가능)
const publicPaths = [
  '/signin',
  '/register', 
  '/register/new-page',
  '/login',
  '/social-login',
  '/',
  '/group',
  '/auth',  // iOS 앱 인증 경로 추가
  '/setting'  // 설정 페이지들은 클라이언트사이드에서 인증 처리
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

// iOS WebView User-Agent 감지
const isIOSWebView = (userAgent: string): boolean => {
  return userAgent.includes('WebKit') && 
         (userAgent.includes('iPhone') || userAgent.includes('iPad')) &&
         !userAgent.includes('Safari');
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = isIOSWebView(userAgent);
  
  console.log('[MIDDLEWARE] 요청 정보:', {
    pathname,
    userAgent: userAgent.substring(0, 100) + '...',
    isIOS,
    method: request.method
  });
  
  // iOS WebView에서 루트 경로 접근 시 특별 처리
  if (isIOS && pathname === '/') {
    console.log('[MIDDLEWARE] 🟢 iOS WebView 루트 경로 접근, 공개 경로로 처리');
    return NextResponse.next();
  }
  
  // 공개 경로는 항상 통과
  if (publicPaths.some(path => pathname.startsWith(path)) || isGroupJoinPath(pathname)) {
    console.log('[MIDDLEWARE] 🟢 공개 경로 통과:', pathname);
    return NextResponse.next();
  }

  // API 경로는 자체 인증 처리
  if (apiPaths.some(path => pathname.startsWith(path))) {
    console.log('[MIDDLEWARE] 🟢 API 경로 통과:', pathname);
    return NextResponse.next();
  }

  // 인증 토큰 확인 (Vercel과 로컬 공통)
  const authToken = request.cookies.get('auth-token')?.value;

  console.log(`[MIDDLEWARE] 경로: ${pathname}, 토큰 존재: ${!!authToken}, iOS: ${isIOS}`);

  // 보호된 경로에 접근하는데 토큰이 없는 경우
  if (!authToken) {
    console.log('[MIDDLEWARE] 🛑 토큰 없음, /signin으로 리디렉션:', pathname);
    const signinUrl = new URL('/signin', request.url);
    signinUrl.searchParams.set('redirect', pathname); // 원래 가려던 경로를 파라미터로 추가
    
    // iOS WebView에서는 쿼리 파라미터로 iOS 플래그 추가
    if (isIOS) {
      signinUrl.searchParams.set('ios', 'true');
    }
    
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
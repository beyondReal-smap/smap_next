import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 인증이 필요하지 않은 공개 경로들
const publicPaths = [
  '/signin',
  '/register',
  '/register-new',
  '/login',
  '/social-login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/images',
  '/icons',
  '/test-api',
  '/test-google',
  '/test-haptic',
  '/test-location-modal'
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
  const hostname = request.nextUrl.hostname;
  
  // Vercel 환경 감지
  const isVercel = hostname.includes('vercel.app') || hostname.includes('nextstep.smap.site');
  
  console.log('[MIDDLEWARE] 요청 경로:', pathname, 'Vercel:', isVercel);
  
  // 공개 경로는 통과 (그룹 가입 페이지도 포함)
  if (publicPaths.some(path => pathname.startsWith(path)) || isGroupJoinPath(pathname)) {
    console.log('[MIDDLEWARE] 🟢 공개 경로 통과:', pathname, {
      isPublicPath: publicPaths.some(path => pathname.startsWith(path)),
      isGroupJoinPath: isGroupJoinPath(pathname),
      isVercel
    });
    return NextResponse.next();
  }

  // API 경로는 별도 처리 (API 자체에서 인증 처리)
  if (apiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Vercel 환경에서는 더 관대한 인증 체크
  if (isVercel) {
    console.log('[MIDDLEWARE] Vercel 환경 - 관대한 인증 체크');
    
    // 클라이언트 사이드 인증으로 처리할 경로들은 항상 통과
    if (clientAuthPaths.some(path => pathname.startsWith(path))) {
      console.log('[MIDDLEWARE] Vercel 환경 - 클라이언트 사이드 인증 경로, 통과:', pathname);
      return NextResponse.next();
    }
    
    // 여러 쿠키에서 토큰 확인
    const authToken = request.cookies.get('auth-token')?.value;
    const clientToken = request.cookies.get('client-token')?.value;
    const legacyToken = request.cookies.get('token')?.value;
    
    const hasAnyToken = authToken || clientToken || legacyToken;
    
    console.log('[MIDDLEWARE] Vercel 토큰 확인:', {
      authToken: !!authToken,
      clientToken: !!clientToken,
      legacyToken: !!legacyToken,
      hasAnyToken
    });
    
    // Vercel 환경에서는 토큰이 없어도 일단 통과 (클라이언트에서 처리)
    if (!hasAnyToken) {
      console.log('[MIDDLEWARE] Vercel 환경에서 토큰 없음, 클라이언트 처리로 위임:', pathname);
      return NextResponse.next();
    }
    
    return NextResponse.next();
  }

  // 일반 환경에서의 기존 로직
  const token = request.cookies.get('token')?.value;
  
  console.log('[MIDDLEWARE] 일반 환경 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
  
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
    // Vercel 환경에서는 토큰 오류도 클라이언트에서 처리
    if (isVercel) {
      console.log('[MIDDLEWARE] Vercel 환경에서 토큰 오류, 클라이언트 처리로 위임:', pathname);
      return NextResponse.next();
    }
    
    // 일반 환경에서는 signin 페이지로 리다이렉트
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
import './globals.css'
import type { Metadata, Viewport } from 'next'
// import { Suspense } from 'react' // Suspense는 ClientLayout 내부 또는 필요시 사용
import { lineSeed } from './fonts'; // LINE SEED 폰트 임포트
// import { BottomNavBar } from './components/layout' // 직접 사용하지 않음
import ClientLayout from './ClientLayout'; // ClientLayout import
import config, { APP_INFO, getLocalizedAppInfo } from '../config'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ['latin'] })

// 언어 설정에 따른 메타데이터 생성
const getMetadata = (): Metadata => {
  const locale = 'ko'
  const localizedInfo = getLocalizedAppInfo(locale)
  
  return {
    title: 'SMAP - 스마트 위치 공유 플랫폼',
    description: '실시간 위치 공유와 그룹 관리 서비스',
    authors: [{ name: localizedInfo.APP_AUTHOR }],
    keywords: [
      'SMAP', '스케줄', '지도', '일정관리', '위치공유', 
      '그룹관리', '모바일앱', '실시간위치', '가족앱', '친구앱'
    ],
    metadataBase: new URL(APP_INFO.DOMAIN),
    
    // Open Graph 최적화
    openGraph: {
      title: localizedInfo.APP_TITLE,
      description: localizedInfo.DESCRIPTION,
      url: APP_INFO.DOMAIN,
      siteName: localizedInfo.APP_TITLE,
      images: [
        {
          url: APP_INFO.OG_IMAGE,
          width: 1200,
          height: 630,
          alt: localizedInfo.APP_TITLE,
        }
      ],
      locale: locale,
      type: 'website',
    },
    
    // Twitter Card 최적화
    twitter: {
      card: 'summary_large_image',
      title: localizedInfo.APP_TITLE,
      description: localizedInfo.DESCRIPTION,
      images: [APP_INFO.OG_IMAGE],
      creator: '@smap_app',
    },
    
    // 앱 매니페스트
    manifest: '/manifest.json',
    
    // 앱 링크
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: localizedInfo.APP_TITLE,
    },
    
    // 검색 엔진 최적화
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    
    // 언어 대체
    alternates: {
      canonical: APP_INFO.DOMAIN,
      languages: {
        'ko-KR': APP_INFO.DOMAIN,
      },
    },
    
    // 카테고리
    category: 'productivity',
    
    // 앱 스토어 링크 (향후 추가)
    // appLinks: {
    //   ios: {
    //     url: 'https://apps.apple.com/app/smap',
    //     app_store_id: 'your_app_id',
    //   },
    //   android: {
    //     package: 'com.smap.app',
    //     url: 'https://play.google.com/store/apps/details?id=com.smap.app',
    //   },
    // },
  }
}

// Viewport 설정을 별도 export로 분리 - iOS 웹뷰 최적화
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // iOS Safe Area 완전 활용
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export const metadata = getMetadata()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* DNS 프리페치 최적화 */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//maps.googleapis.com" />
        <link rel="dns-prefetch" href="//navermaps.github.io" />
        
        {/* 프리로드 최적화 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preload" href="/fonts/LINESeedKR-Rg.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/LINESeedKR-Bd.woff2" as="font" type="font/woff2" crossOrigin="" />
        
        {/* 성능 최적화 리소스 힌트 */}
        <link rel="dns-prefetch" href="//nextstep.smap.site" />
        <link rel="preconnect" href="https://nextstep.smap.site" />
        
        {/* Critical CSS inline - LCP 개선 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html { font-size: 16px; line-height: 1.5; }
            body { font-family: var(--font-line-seed), -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; }
            .header-fixed { height: 64px !important; min-height: 64px !important; }
            .navigation-fixed { height: 80px !important; min-height: 80px !important; }
            .prevent-layout-shift { contain: layout style paint; will-change: auto; }
            .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite; }
            @keyframes skeleton-loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
          `
        }} />
        
        {/* 전역 에러 핸들러 (가장 먼저 로드) */}
        <script src="/error-handler.js" async></script>
        
        {/* iOS 웹뷰 타임아웃 방지 및 최적화 스크립트 */}
        <script src="/ios-webview-fix.js" async></script>
        
        {/* iOS 웹뷰 브릿지 */}
        <script src="/ios-bridge.js" async></script>
        
        {/* Google Identity Services SDK - iOS WebView 호환성 개선 */}
        <script 
          src="https://accounts.google.com/gsi/client" 
          async 
          defer
        ></script>
        
        {/* iOS WebView에서 스크립트 실행 개선 */}
        <script 
          dangerouslySetInnerHTML={{
            __html: `
              // iOS WebView 환경에서 안전한 스크립트 실행
              (function() {
                const isIOSWebView = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                                   !!(window.webkit && window.webkit.messageHandlers);
                
                if (isIOSWebView) {
                  console.log('[iOS WebView] 안전한 스크립트 실행 모드 활성화');
                  
                  // Next.js 스크립트 파싱 오류 방지
                  const originalPush = Array.prototype.push;
                  if (typeof window !== 'undefined') {
                    // self.__next_f 및 self.__next_s 에러 방지
                    window.self = window.self || window;
                    window.self.__next_f = window.self.__next_f || [];
                    window.self.__next_s = window.self.__next_s || [];
                    
                    // push 함수 안전성 강화
                    const safePush = function(...args) {
                      try {
                        return originalPush.apply(this, args);
                      } catch (error) {
                        console.warn('[iOS WebView] Array push 오류 무시:', error);
                        return this.length;
                      }
                    };
                    
                    // Next.js 배열에 안전한 push 적용
                    if (window.self.__next_f && Array.isArray(window.self.__next_f)) {
                      window.self.__next_f.push = safePush.bind(window.self.__next_f);
                    }
                    if (window.self.__next_s && Array.isArray(window.self.__next_s)) {
                      window.self.__next_s.push = safePush.bind(window.self.__next_s);
                    }
                  }
                  
                  // 스크립트 파싱 오류 전역 처리
                  window.addEventListener('error', function(e) {
                    // Next.js 관련 오류 무시
                    if (e.message && (
                      e.message.includes('__next_') ||
                      e.message.includes('Unexpected token') ||
                      e.message.includes('SyntaxError') ||
                      e.filename && e.filename.includes('_next/static')
                    )) {
                      console.warn('[iOS WebView] Next.js 스크립트 오류 무시:', e.message);
                      e.preventDefault();
                      return true;
                    }
                    
                    // Google GSI 오류 무시
                    if (e.filename && e.filename.includes('accounts.google.com')) {
                      console.warn('[iOS WebView] Google GSI 스크립트 오류 무시:', e.message);
                      e.preventDefault();
                      return true;
                    }
                  });
                  
                  // 브라우저 차단 이벤트 최소화
                  const safePreventDefault = (e) => {
                    try {
                      if (e && typeof e.preventDefault === 'function') {
                        e.preventDefault();
                      }
                    } catch (error) {
                      // 무시
                    }
                  };
                  
                  // iOS에서 차단되는 이벤트들을 더 안전하게 처리
                  ['pagehide', 'visibilitychange', 'unload'].forEach(eventType => {
                    const originalHandler = window['on' + eventType];
                    
                    Object.defineProperty(window, 'on' + eventType, {
                      set: function(handler) {
                        if (handler) {
                          const safeHandler = function(e) {
                            try {
                              return handler.call(this, e);
                            } catch (error) {
                              console.warn('[iOS WebView] 이벤트 처리 중 오류 (무시):', eventType, error);
                            }
                          };
                          
                          if (originalHandler) {
                            originalHandler.call(this, safeHandler);
                          }
                        }
                      },
                      configurable: true
                    });
                  });
                }
              })();
            `,
          }}
        />
        
        {/* iOS WebView Array.isArray 에러 방지 전역 폴리필 */}
        <Script id="array-polyfill" strategy="beforeInteractive">
          {`
            (function() {
              if (typeof window !== 'undefined') {
                try {
                  // Array.isArray 에러 방지 - 전역 폴리필
                  if (typeof Array === 'undefined' || !Array || typeof Array.isArray !== 'function') {
                    console.warn('[LAYOUT] Array.isArray 손상 감지 - 글로벌 복구');
                    
                    if (!window.Array) {
                      window.Array = function() {
                        const arr = [];
                        for (let i = 0; i < arguments.length; i++) {
                          arr[i] = arguments[i];
                        }
                        return arr;
                      };
                    }
                    
                    if (!window.Array.isArray) {
                      window.Array.isArray = function(obj) {
                        if (obj === null || obj === undefined) return false;
                        try {
                          return Object.prototype.toString.call(obj) === '[object Array]';
                        } catch (e) {
                          return !!(obj && typeof obj === 'object' && 
                                   typeof obj.length === 'number' && 
                                   typeof obj.push === 'function');
                        }
                      };
                    }
                    
                    // 전역 스코프에 할당
                    if (typeof globalThis !== 'undefined') {
                      globalThis.Array = window.Array;
                    }
                    if (typeof self !== 'undefined') {
                      self.Array = window.Array;
                    }
                  }
                  
                  console.log('[LAYOUT] Array.isArray 글로벌 폴리필 적용 완료');
                } catch (error) {
                  console.error('[LAYOUT] Array.isArray 글로벌 폴리필 실패:', error);
                }
              }
            })();
          `}
        </Script>
        
        {/* iOS WebView 환경 개선 스크립트 */}
        <Script src="/ios-webview-fix.js" strategy="beforeInteractive" />
        
        {/* 에러 핸들러 스크립트 */}
        <Script src="/error-handler.js" strategy="beforeInteractive" />
      </head>
      <body className={`${lineSeed.variable} font-sans antialiased ${inter.className}`} suppressHydrationWarning>
        <ClientLayout>
          {children} 
        </ClientLayout>
        {/* DatePicker 캘린더 포털용 div 추가 */}
        <div id="root-portal"></div>
        {/* SpeedInsights for Vercel */}
        <SpeedInsights />
        {/* Analytics for Vercel */}
        <Analytics />
        {/* 성능 모니터링 (개발 환경에서만) */}
        {process.env.NODE_ENV === 'development' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('performance' in window) {
                  window.addEventListener('load', () => {
                    setTimeout(() => {
                      const perfData = performance.getEntriesByType('navigation')[0];
                      console.log('페이지 로드 시간:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
                    }, 0);
                  });
                }
              `,
            }}
          />
        )}
      </body>
    </html>
  )
} 
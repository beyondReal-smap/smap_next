import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'SMAP - 활동 로그',
  description: '그룹 멤버들의 실시간 위치 기록과 활동 패턴을 확인하고 분석할 수 있는 활동 로그 페이지',
  keywords: ['활동로그', '위치기록', '활동패턴', '멤버활동', '실시간추적', '위치분석', '이동경로', '활동통계'],
  authors: [{ name: 'SMAP Team' }],
  creator: 'SMAP',
  publisher: 'SMAP',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
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
  openGraph: {
    title: 'SMAP - 활동 로그',
    description: '그룹 멤버들의 실시간 위치 기록과 활동 패턴을 확인하고 분석할 수 있는 활동 로그 페이지',
          url: 'https://nextstep.smap.site/activelog',
    siteName: 'SMAP',
    images: [
      {
        url: 'https://nextstep.smap.site/images/og-activelog.jpg',
        width: 1200,
        height: 630,
        alt: 'SMAP 활동 로그',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SMAP - 활동 로그',
    description: '그룹 멤버들의 실시간 위치 기록과 활동 패턴을 확인하고 분석할 수 있는 활동 로그 페이지',
          images: ['https://nextstep.smap.site/images/og-activelog.jpg'],
  },
  alternates: {
          canonical: 'https://nextstep.smap.site/activelog',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0113A3' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
  colorScheme: 'light dark',
}

export default function ActivelogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          :root {
                --activelog-primary: #0113A3;
    --activelog-primary-hover: #0f3cc9;
    --activelog-secondary: #6366f1;
    --activelog-accent: #f472b6;
    --activelog-success: #10b981;
    --activelog-warning: #f59e0b;
    --activelog-error: #ef4444;
    --activelog-bg-gradient: linear-gradient(to bottom right, #f0f9ff, #fdf4ff);
    --activelog-glass: rgba(255, 255, 255, 0.7);
    --activelog-shadow: 0 8px 25px rgba(1, 19, 163, 0.15);
    --activelog-border: rgba(1, 19, 163, 0.1);
    --activelog-text: #1f2937;
    --activelog-text-muted: #6b7280;
    --activelog-animation-duration: 0.3s;
    --activelog-animation-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }

          @media (prefers-color-scheme: dark) {
            :root {
                  --activelog-primary: #1e40af;
    --activelog-primary-hover: #3b82f6;
    --activelog-secondary: #8b5cf6;
    --activelog-accent: #ec4899;
    --activelog-success: #059669;
    --activelog-warning: #d97706;
    --activelog-error: #dc2626;
    --activelog-bg-gradient: linear-gradient(to bottom right, #0f172a, #1e1b4b);
    --activelog-glass: rgba(30, 41, 59, 0.7);
    --activelog-shadow: 0 8px 25px rgba(30, 64, 175, 0.3);
    --activelog-border: rgba(30, 64, 175, 0.2);
    --activelog-text: #f9fafb;
    --activelog-text-muted: #9ca3af;
            }
          }

          /* 활동로그 페이지 전용 최적화 */
          .activelog-page {
            background: var(--activelog-bg-gradient);
            min-height: 100vh;
            color: var(--activelog-text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          /* 성능 최적화 */
          .activelog-page * {
            box-sizing: border-box;
          }

          .activelog-page img {
            max-width: 100%;
            height: auto;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }

          /* 애니메이션 최적화 */
          .activelog-page .hardware-accelerated {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            perspective: 1000px;
            -webkit-perspective: 1000px;
          }

          /* 터치 최적화 */
          .activelog-page button,
          .activelog-page [role="button"] {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            user-select: none;
            cursor: pointer;
          }

          /* 스크롤 최적화 */
          .activelog-page .scroll-container {
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .activelog-page .scroll-container::-webkit-scrollbar {
            display: none;
          }

          /* 포커스 관리 */
          .activelog-page *:focus {
            outline: 2px solid var(--activelog-primary);
            outline-offset: 2px;
          }

          .activelog-page *:focus:not(:focus-visible) {
            outline: none;
          }

          /* 접근성 */
          @media (prefers-reduced-motion: reduce) {
            .activelog-page *,
            .activelog-page *::before,
            .activelog-page *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }

          @media (prefers-contrast: high) {
            .activelog-page {
              --activelog-border: #000;
              --activelog-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
            }
          }

          /* 모바일 최적화 */
          @media (max-width: 768px) {
            .activelog-page {
              font-size: 14px;
            }
          }

          /* 지도 컨테이너 최적화 */
          .activelog-page .map-container {
            contain: layout style paint;
            will-change: transform;
          }

          /* 이미지 로딩 최적화 */
          .activelog-page .member-image {
            transition: opacity var(--activelog-animation-duration) var(--activelog-animation-easing);
          }

          .activelog-page .member-image.loading {
            opacity: 0.7;
          }

          .activelog-page .member-image.loaded {
            opacity: 1;
          }

          /* 로그 페이지 버튼 스타일 제거됨 - 통합 플로팅 버튼 사용 */
        `
      }} />
      
      {/* Preload critical resources */}
      <link rel="preconnect" href="https://openapi.map.naver.com" />
      <link rel="preconnect" href="https://118.67.130.71:8000" />
      <link rel="dns-prefetch" href="https://oapi.map.naver.com" />
      
      <div className="activelog-page">
        {children}
      </div>
    </>
  )
} 
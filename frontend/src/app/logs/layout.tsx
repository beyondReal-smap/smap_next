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
    url: 'https://smap.co.kr/logs',
    siteName: 'SMAP',
    images: [
      {
        url: 'https://smap.co.kr/images/og-logs.jpg',
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
    images: ['https://smap.co.kr/images/og-logs.jpg'],
  },
  alternates: {
    canonical: 'https://smap.co.kr/logs',
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

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          :root {
            --logs-primary: #0113A3;
            --logs-primary-hover: #0f3cc9;
            --logs-secondary: #6366f1;
            --logs-accent: #f472b6;
            --logs-success: #10b981;
            --logs-warning: #f59e0b;
            --logs-error: #ef4444;
            --logs-bg-gradient: linear-gradient(to bottom right, #f0f9ff, #fdf4ff);
            --logs-glass: rgba(255, 255, 255, 0.7);
            --logs-shadow: 0 8px 25px rgba(1, 19, 163, 0.15);
            --logs-border: rgba(1, 19, 163, 0.1);
            --logs-text: #1f2937;
            --logs-text-muted: #6b7280;
            --logs-animation-duration: 0.3s;
            --logs-animation-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --logs-primary: #1e40af;
              --logs-primary-hover: #3b82f6;
              --logs-secondary: #8b5cf6;
              --logs-accent: #ec4899;
              --logs-success: #059669;
              --logs-warning: #d97706;
              --logs-error: #dc2626;
              --logs-bg-gradient: linear-gradient(to bottom right, #0f172a, #1e1b4b);
              --logs-glass: rgba(30, 41, 59, 0.7);
              --logs-shadow: 0 8px 25px rgba(30, 64, 175, 0.3);
              --logs-border: rgba(30, 64, 175, 0.2);
              --logs-text: #f9fafb;
              --logs-text-muted: #9ca3af;
            }
          }

          /* 로그 페이지 전용 최적화 */
          .logs-page {
            background: var(--logs-bg-gradient);
            min-height: 100vh;
            color: var(--logs-text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          /* 성능 최적화 */
          .logs-page * {
            box-sizing: border-box;
          }

          .logs-page img {
            max-width: 100%;
            height: auto;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }

          /* 애니메이션 최적화 */
          .logs-page .hardware-accelerated {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            perspective: 1000px;
            -webkit-perspective: 1000px;
          }

          /* 터치 최적화 */
          .logs-page button,
          .logs-page [role="button"] {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            user-select: none;
            cursor: pointer;
          }

          /* 스크롤 최적화 */
          .logs-page .scroll-container {
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .logs-page .scroll-container::-webkit-scrollbar {
            display: none;
          }

          /* 포커스 관리 */
          .logs-page *:focus {
            outline: 2px solid var(--logs-primary);
            outline-offset: 2px;
          }

          .logs-page *:focus:not(:focus-visible) {
            outline: none;
          }

          /* 접근성 */
          @media (prefers-reduced-motion: reduce) {
            .logs-page *,
            .logs-page *::before,
            .logs-page *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }

          @media (prefers-contrast: high) {
            .logs-page {
              --logs-border: #000;
              --logs-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
            }
          }

          /* 모바일 최적화 */
          @media (max-width: 768px) {
            .logs-page {
              font-size: 14px;
            }
          }

          /* 지도 컨테이너 최적화 */
          .logs-page .map-container {
            contain: layout style paint;
            will-change: transform;
          }

          /* 이미지 로딩 최적화 */
          .logs-page .member-image {
            transition: opacity var(--logs-animation-duration) var(--logs-animation-easing);
          }

          .logs-page .member-image.loading {
            opacity: 0.7;
          }

          .logs-page .member-image.loaded {
            opacity: 1;
          }

          /* 로그 페이지 버튼 스타일 제거됨 - 통합 플로팅 버튼 사용 */
        `
      }} />
      
      {/* Preload critical resources */}
      <link rel="preconnect" href="https://openapi.map.naver.com" />
      <link rel="preconnect" href="https://118.67.130.71:8000" />
      <link rel="dns-prefetch" href="https://oapi.map.naver.com" />
      
      <div className="logs-page">
        {children}
      </div>
    </>
  )
} 
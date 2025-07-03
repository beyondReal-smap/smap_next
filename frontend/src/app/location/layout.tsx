import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'SMAP - 내 장소',
  description: '그룹 멤버들과 장소를 공유하고 관리하세요! 실시간 위치 기반 장소 관리 서비스',
  keywords: ['위치공유', '내장소', '장소관리', '실시간위치', '그룹장소', 'GPS', '위치추적'],
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
    title: 'SMAP - 내 장소',
    description: '그룹 멤버들과 장소를 공유하고 관리하세요!',
    url: 'https://smap.co.kr/location',
    siteName: 'SMAP',
    images: [
      {
        url: 'https://smap.co.kr/images/og-location.jpg',
        width: 1200,
        height: 630,
        alt: 'SMAP 내 장소',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SMAP - 내 장소',
    description: '그룹 멤버들과 장소를 공유하고 관리하세요!',
    images: ['https://smap.co.kr/images/og-location.jpg'],
  },
  alternates: {
    canonical: 'https://smap.co.kr/location',
  },
};

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
};

export default function LocationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          :root {
            --location-primary: #0113A3;
            --location-primary-hover: #0f3cc9;
            --location-secondary: #6366f1;
            --location-accent: #f472b6;
            --location-success: #10b981;
            --location-warning: #f59e0b;
            --location-error: #ef4444;
            --location-bg-gradient: linear-gradient(to bottom right, #f0f9ff, #fdf4ff);
            --location-glass: rgba(255, 255, 255, 0.7);
            --location-shadow: 0 8px 25px rgba(1, 19, 163, 0.15);
            --location-border: rgba(1, 19, 163, 0.1);
            --location-text: #1f2937;
            --location-text-muted: #6b7280;
            --location-animation-duration: 0.3s;
            --location-animation-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --location-primary: #1e40af;
              --location-primary-hover: #3b82f6;
              --location-secondary: #8b5cf6;
              --location-accent: #ec4899;
              --location-success: #059669;
              --location-warning: #d97706;
              --location-error: #dc2626;
              --location-bg-gradient: linear-gradient(to bottom right, #0f172a, #1e1b4b);
              --location-glass: rgba(30, 41, 59, 0.7);
              --location-shadow: 0 8px 25px rgba(30, 64, 175, 0.3);
              --location-border: rgba(30, 64, 175, 0.2);
              --location-text: #f9fafb;
              --location-text-muted: #9ca3af;
            }
          }

          .location-page {
            background: var(--location-bg-gradient);
            min-height: 100vh;
            color: var(--location-text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          .location-page * {
            box-sizing: border-box;
          }

          .location-page img {
            max-width: 100%;
            height: auto;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }

          .location-page .hardware-accelerated {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            perspective: 1000px;
            -webkit-perspective: 1000px;
          }

          .location-page button,
          .location-page [role="button"] {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            user-select: none;
            cursor: pointer;
          }

          .location-page .scroll-container {
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .location-page .scroll-container::-webkit-scrollbar {
            display: none;
          }

          .location-page *:focus {
            outline: 2px solid var(--location-primary);
            outline-offset: 2px;
          }

          .location-page *:focus:not(:focus-visible) {
            outline: none;
          }

          @media (prefers-reduced-motion: reduce) {
            .location-page *,
            .location-page *::before,
            .location-page *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }

          @media (prefers-contrast: high) {
            .location-page {
              --location-border: #000;
              --location-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
            }
          }

          @media (max-width: 768px) {
            .location-page {
              font-size: 14px;
            }
          }

          .location-page .map-container {
            contain: layout style paint;
            will-change: transform;
          }

          .location-page .member-image {
            transition: opacity var(--location-animation-duration) var(--location-animation-easing);
          }

          .location-page .member-image.loading {
            opacity: 0.7;
          }

          .location-page .member-image.loaded {
            opacity: 1;
          }
        `
      }} />
      {/* Preload critical resources */}
      <link rel="preconnect" href="https://openapi.map.naver.com" />
      <link rel="preconnect" href="https://118.67.130.71:8000" />
      <link rel="dns-prefetch" href="https://oapi.map.naver.com" />
      {/* Preload fonts */}
      <link
        rel="preload"
        href="/fonts/LINESeedKR-Rg.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <div className="location-page">
        {children}
      </div>
    </>
  );
} 
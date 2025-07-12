import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'SMAP - 홈',
  description: '실시간 위치 공유와 스케줄 관리를 한번에! 가족, 친구들과 함께하는 스마트한 위치 공유 서비스',
  keywords: ['위치공유', '실시간위치', '가족안전', '친구찾기', '스케줄관리', 'GPS', '위치추적', '안전서비스'],
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
    title: 'SMAP - 홈',
    description: '실시간 위치 공유와 스케줄 관리를 한번에!',
    url: 'https://smap.co.kr/home',
    siteName: 'SMAP',
    images: [
      {
        url: '/images/og-home.jpg',
        width: 1200,
        height: 630,
        alt: 'SMAP 홈 - 실시간 위치 공유 서비스',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SMAP - 홈',
    description: '실시간 위치 공유와 스케줄 관리를 한번에!',
    images: ['/images/twitter-home.jpg'],
  },
  alternates: {
    canonical: 'https://smap.co.kr/home',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0113A3' },
    { media: '(prefers-color-scheme: dark)', color: '#001a8a' },
  ],
  colorScheme: 'light dark',
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://maps.googleapis.com" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="//maps.googleapis.com" />
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="dns-prefetch" href="//fonts.gstatic.com" />
      
      <link 
        rel="preload" 
        href="/images/avatar1.png" 
        as="image" 
        type="image/png"
      />
      <link 
        rel="preload" 
        href="/images/avatar2.png" 
        as="image" 
        type="image/png"
      />
      <link 
        rel="preload" 
        href="/images/avatar3.png" 
        as="image" 
        type="image/png"
      />
      
      <style dangerouslySetInnerHTML={{
        __html: `
          /* Critical CSS for Home Layout */
          .home-layout {
            --primary-color: #0113A3;
            --primary-dark: #001a8a;
            --secondary-color: #f0f9ff;
            --accent-color: #fdf4ff;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --border-color: rgba(1, 19, 163, 0.1);
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            --radius-sm: 0.375rem;
            --radius-md: 0.5rem;
            --radius-lg: 0.75rem;
            --radius-xl: 1rem;
            --radius-2xl: 1.5rem;
            --spacing-xs: 0.25rem;
            --spacing-sm: 0.5rem;
            --spacing-md: 1rem;
            --spacing-lg: 1.5rem;
            --spacing-xl: 2rem;
            --spacing-2xl: 3rem;
            --transition-fast: 0.15s ease-out;
            --transition-normal: 0.3s ease-out;
            --transition-slow: 0.5s ease-out;
            --z-dropdown: 1000;
            --z-sticky: 1020;
            --z-fixed: 1030;
            --z-modal-backdrop: 1040;
            --z-modal: 1050;
            --z-popover: 1060;
            --z-tooltip: 1070;
            --z-toast: 1080;
          }

          /* Performance optimizations */
          .home-layout * {
            box-sizing: border-box;
          }

          .home-layout img {
            max-width: 100%;
            height: auto;
          }

          .home-layout button {
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }

          .home-layout input,
          .home-layout textarea,
          .home-layout select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
          }

          /* Accessibility improvements */
          @media (prefers-reduced-motion: reduce) {
            .home-layout *,
            .home-layout *::before,
            .home-layout *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }

          @media (prefers-contrast: high) {
            .home-layout {
              --border-color: #000;
              --text-secondary: #000;
            }
          }

          /* Dark mode preparation */
          @media (prefers-color-scheme: dark) {
            .home-layout {
              --primary-color: #1e40af;
              --primary-dark: #1e3a8a;
              --secondary-color: #1e293b;
              --accent-color: #334155;
              --text-primary: #f8fafc;
              --text-secondary: #cbd5e1;
              --border-color: rgba(148, 163, 184, 0.2);
            }
          }

          /* Hardware acceleration for animations */
          .home-layout .transform,
          .home-layout .translate,
          .home-layout .scale,
          .home-layout .rotate {
            transform: translate3d(0, 0, 0);
            will-change: transform;
          }

          /* Touch optimization */
          .home-layout .touch-target {
            min-height: 44px;
            min-width: 44px;
          }

          /* Loading states */
          .home-layout .loading-shimmer {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }

          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }

          /* Scroll optimization */
          .home-layout .scroll-smooth {
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }

          /* Memory efficient animations */
          .home-layout .animate-efficient {
            animation-fill-mode: both;
            backface-visibility: hidden;
            perspective: 1000px;
          }

          /* 헤더 패딩 강제 제거 */
          .home-layout header,
          .home-layout .header-fixed,
          .home-layout .glass-effect {
            padding: 0px !important;
            margin: 0px !important;
            padding-top: 0px !important;
            margin-top: 0px !important;
            top: 0px !important;
          }

          /* 헤더 내부 컨테이너 패딩 제거 */
          .home-layout header > div,
          .home-layout .header-fixed > div {
            padding-top: 0px !important;
            margin-top: 0px !important;
          }
        `
      }} />
      
      <div className="home-layout">
        {children}
      </div>
    </>
  );
} 
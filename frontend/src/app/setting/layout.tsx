import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'SMAP - 설정',
  description: '개인정보 관리, 알림 설정, 개인화 옵션을 통해 SMAP을 나만의 서비스로 만들어보세요',
  keywords: ['설정', '개인정보', '알림설정', '프로필관리', '계정설정', '개인화', '사용자설정'],
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
    title: 'SMAP - 설정',
    description: '개인정보 관리, 알림 설정, 개인화 옵션을 통해 SMAP을 나만의 서비스로 만들어보세요',
    url: 'https://smap.co.kr/setting',
    siteName: 'SMAP',
    images: [
      {
        url: '/images/og-setting.jpg',
        width: 1200,
        height: 630,
        alt: 'SMAP 설정 - 개인화 및 계정 관리',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SMAP - 설정',
    description: '개인정보 관리, 알림 설정, 개인화 옵션을 통해 SMAP을 나만의 서비스로 만들어보세요',
    images: ['/images/twitter-setting.jpg'],
  },
  alternates: {
    canonical: 'https://smap.co.kr/setting',
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

export default function SettingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
          /* Critical CSS for Setting Layout */
          .setting-layout {
            --primary-color: #0113A3;
            --primary-dark: #001a8a;
            --primary-light: #3b82f6;
            --secondary-color: #f0f9ff;
            --accent-color: #fdf4ff;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --error-color: #ef4444;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --text-muted: #9ca3af;
            --background-primary: #ffffff;
            --background-secondary: #f9fafb;
            --background-tertiary: #f3f4f6;
            --border-color: rgba(1, 19, 163, 0.1);
            --border-light: #e5e7eb;
            --border-medium: #d1d5db;
            --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            --radius-xs: 0.125rem;
            --radius-sm: 0.25rem;
            --radius-md: 0.375rem;
            --radius-lg: 0.5rem;
            --radius-xl: 0.75rem;
            --radius-2xl: 1rem;
            --radius-3xl: 1.5rem;
            --spacing-0: 0;
            --spacing-1: 0.25rem;
            --spacing-2: 0.5rem;
            --spacing-3: 0.75rem;
            --spacing-4: 1rem;
            --spacing-5: 1.25rem;
            --spacing-6: 1.5rem;
            --spacing-8: 2rem;
            --spacing-10: 2.5rem;
            --spacing-12: 3rem;
            --spacing-16: 4rem;
            --spacing-20: 5rem;
            --transition-fast: 0.1s ease-out;
            --transition-normal: 0.2s ease-out;
            --transition-slow: 0.3s ease-out;
            --transition-slower: 0.5s ease-out;
            --z-dropdown: 1000;
            --z-sticky: 1020;
            --z-fixed: 1030;
            --z-modal-backdrop: 1040;
            --z-modal: 1050;
            --z-popover: 1060;
            --z-tooltip: 1070;
            --z-toast: 1080;
          }

          /* Base optimizations */
          .setting-layout * {
            box-sizing: border-box;
          }

          .setting-layout *::before,
          .setting-layout *::after {
            box-sizing: border-box;
          }

          .setting-layout img {
            max-width: 100%;
            height: auto;
            display: block;
          }

          .setting-layout button {
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }

          .setting-layout input,
          .setting-layout textarea,
          .setting-layout select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            font-family: inherit;
            font-size: inherit;
          }

          .setting-layout a {
            color: inherit;
            text-decoration: none;
          }

          /* Performance optimizations */
          .setting-layout .transform,
          .setting-layout .translate,
          .setting-layout .scale,
          .setting-layout .rotate {
            transform: translate3d(0, 0, 0);
            will-change: transform;
          }

          .setting-layout .gpu-accelerated {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            perspective: 1000px;
            -webkit-perspective: 1000px;
          }

          /* Touch optimization */
          .setting-layout .touch-target {
            min-height: 44px;
            min-width: 44px;
            position: relative;
          }

          .setting-layout .touch-feedback:active {
            transform: scale(0.98);
            transition: transform var(--transition-fast);
          }

          /* Loading states */
          .setting-layout .loading-shimmer {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }

          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }

          .setting-layout .loading-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          /* Scroll optimization */
          .setting-layout .scroll-smooth {
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }

          .setting-layout .scroll-container {
            contain: layout style paint;
            overflow-anchor: auto;
          }

          /* Form optimizations */
          .setting-layout .form-control {
            transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
          }

          .setting-layout .form-control:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(1, 19, 163, 0.1);
          }

          /* Button optimizations */
          .setting-layout .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: var(--radius-lg);
            font-weight: 500;
            transition: all var(--transition-normal);
            position: relative;
            overflow: hidden;
          }

          .setting-layout .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            pointer-events: none;
          }

          .setting-layout .btn-primary {
            background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
            color: white;
          }

          .setting-layout .btn-primary:hover:not(:disabled) {
            background: linear-gradient(135deg, var(--primary-dark), var(--primary-color));
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
          }

          .setting-layout .btn-secondary {
            background: var(--background-secondary);
            color: var(--text-primary);
            border: 1px solid var(--border-light);
          }

          .setting-layout .btn-secondary:hover:not(:disabled) {
            background: var(--background-tertiary);
            border-color: var(--border-medium);
          }

          /* Card optimizations */
          .setting-layout .card {
            background: var(--background-primary);
            border-radius: var(--radius-2xl);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border-color);
            transition: box-shadow var(--transition-normal), transform var(--transition-normal);
          }

          .setting-layout .card:hover {
            box-shadow: var(--shadow-md);
          }

          .setting-layout .card-interactive:hover {
            transform: translateY(-2px);
          }

          /* Accessibility improvements */
          @media (prefers-reduced-motion: reduce) {
            .setting-layout *,
            .setting-layout *::before,
            .setting-layout *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }

          @media (prefers-contrast: high) {
            .setting-layout {
              --border-color: #000000;
              --border-light: #000000;
              --text-secondary: #000000;
              --text-muted: #333333;
            }
          }

          @media (max-width: 640px) {
            .setting-layout {
              --spacing-4: 0.75rem;
              --spacing-6: 1rem;
              --spacing-8: 1.5rem;
            }
          }

          /* Dark mode preparation */
          @media (prefers-color-scheme: dark) {
            .setting-layout {
              --primary-color: #3b82f6;
              --primary-dark: #1e40af;
              --primary-light: #60a5fa;
              --secondary-color: #1e293b;
              --accent-color: #334155;
              --text-primary: #f8fafc;
              --text-secondary: #cbd5e1;
              --text-muted: #94a3b8;
              --background-primary: #0f172a;
              --background-secondary: #1e293b;
              --background-tertiary: #334155;
              --border-color: rgba(148, 163, 184, 0.2);
              --border-light: #334155;
              --border-medium: #475569;
            }
          }

          /* High-performance animations */
          .setting-layout .animate-efficient {
            animation-fill-mode: both;
            backface-visibility: hidden;
            perspective: 1000px;
            contain: layout style paint;
          }

          /* Memory optimization */
          .setting-layout .contain-layout {
            contain: layout;
          }

          .setting-layout .contain-paint {
            contain: paint;
          }

          .setting-layout .contain-style {
            contain: style;
          }

          .setting-layout .contain-all {
            contain: layout style paint;
          }

          /* Focus management */
          .setting-layout .focus-visible:focus-visible {
            outline: 2px solid var(--primary-color);
            outline-offset: 2px;
          }

          .setting-layout .focus-visible:focus:not(:focus-visible) {
            outline: none;
          }

          /* Print optimization */
          @media print {
            .setting-layout {
              background: white !important;
              color: black !important;
            }
            
            .setting-layout * {
              background: transparent !important;
              color: black !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }
          }
        `
      }} />
      
      <div className="setting-layout">
        {children}
      </div>
    </>
  );
} 
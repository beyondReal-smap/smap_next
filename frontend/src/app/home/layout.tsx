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
    <div className="min-h-screen home-layout">
      {children}
    </div>
  );
} 
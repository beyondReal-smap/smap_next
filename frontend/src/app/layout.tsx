import './globals.css'
import type { Metadata, Viewport } from 'next'
// import { Suspense } from 'react' // Suspense는 ClientLayout 내부 또는 필요시 사용
import { lineSeed } from './fonts'; // LINE SEED 폰트 임포트
// import { BottomNavBar } from './components/layout' // 직접 사용하지 않음
import ClientLayout from './ClientLayout'; // ClientLayout import
import config, { APP_INFO, getLocalizedAppInfo } from '../config'

// 언어 설정에 따른 메타데이터 생성
const getMetadata = (): Metadata => {
  const locale = 'ko'
  const localizedInfo = getLocalizedAppInfo(locale)
  
  return {
    title: {
      default: localizedInfo.APP_TITLE,
      template: `%s | ${localizedInfo.APP_TITLE}`,
    },
    description: localizedInfo.DESCRIPTION,
    authors: [{ name: localizedInfo.APP_AUTHOR }],
    keywords: [
      '스맵', 'SMAP', '스케줄', '지도', '일정관리', '위치공유', 
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

// Viewport 설정을 별도 export로 분리
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#22C55D' },
    { media: '(prefers-color-scheme: dark)', color: '#16A34A' },
  ],
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
        
        {/* 폰트 프리로드 제거 - CSS에서 필요시 로드되도록 함 */}
        
        {/* iOS 웹뷰 브릿지 */}
        <script src="/ios-bridge.js" async></script>
      </head>
      <body className={`${lineSeed.variable} font-sans antialiased`} suppressHydrationWarning>
        <ClientLayout>
          {/* ClientLayout이 children을 받아 내부에서 main 등의 구조를 관리하도록 위임 가능 */} 
          {/* 또는 여기서 최소한의 구조만 남기고 ClientLayout에 더 많은 책임을 부여 */} 
          {children} 
        </ClientLayout>
        {/* DatePicker 캘린더 포털용 div 추가 */}
        <div id="root-portal"></div>
        
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
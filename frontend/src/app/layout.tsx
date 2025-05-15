import './globals.css'
import type { Metadata } from 'next'
// import { Suspense } from 'react' // Suspense는 ClientLayout 내부 또는 필요시 사용
import { lineSeed } from './fonts'; // LINE SEED 폰트 임포트
// import { BottomNavBar } from './components/layout' // 직접 사용하지 않음
import ClientLayout from './ClientLayout'; // ClientLayout import
import config, { APP_INFO, getLocalizedAppInfo } from '../config'

// const inter = Inter({ subsets: ['latin'] }) // Inter 폰트 인스턴스 제거

// 언어 설정에 따른 메타데이터 생성
const getMetadata = (): Metadata => {
  const locale = 'ko' // 서버 사이드에서는 기본값 사용
  const localizedInfo = getLocalizedAppInfo(locale)
  
  return {
    title: localizedInfo.APP_TITLE,
    description: localizedInfo.DESCRIPTION,
    authors: [{ name: localizedInfo.APP_AUTHOR }],
    keywords: '',
    metadataBase: new URL(APP_INFO.DOMAIN),
    openGraph: {
      title: localizedInfo.APP_TITLE,
      description: localizedInfo.DESCRIPTION,
      url: APP_INFO.DOMAIN,
      siteName: localizedInfo.APP_TITLE,
      images: [APP_INFO.OG_IMAGE],
      locale: locale,
      type: 'website',
    },
  }
}

export const metadata = getMetadata()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      {/* lineSeed.variable을 사용하여 폰트 변수 적용 및 기본 sans 클래스 추가 */}
      <body className={`${lineSeed.variable} font-sans`}>
        <ClientLayout> 
          {/* ClientLayout이 children을 받아 내부에서 main 등의 구조를 관리하도록 위임 가능 */} 
          {/* 또는 여기서 최소한의 구조만 남기고 ClientLayout에 더 많은 책임을 부여 */} 
          {children} 
        </ClientLayout>
        {/* DatePicker 캘린더 포털용 div 추가 */}
        <div id="root-portal"></div>
      </body>
    </html>
  )
} 
import './globals.css'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Inter } from 'next/font/google'
import { BottomNavBar } from './components/layout'
import config, { APP_INFO, getLocalizedAppInfo } from '../config'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 pb-20">
          <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
          <BottomNavBar />
        </div>
      </body>
    </html>
  )
} 
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthHeader from '../components/AuthHeader'
import ErrorBoundary from '../components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SMAP - 스마트 위치 기반 그룹 관리',
  description: '실시간 위치 공유와 스케줄 관리를 통한 스마트한 그룹 관리 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <script src="/error-handler.js" defer></script>
        <script src="/ios-webview-fix.js" defer></script>
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex items-center">
                    <h1 className="text-xl font-bold text-blue-600">SMAP</h1>
                  </div>
                  <div className="flex items-center space-x-4">
                    <a href="/" className="text-gray-700 hover:text-blue-600">홈</a>
                    <a href="/group" className="text-gray-700 hover:text-blue-600">그룹</a>
                    <a href="/location" className="text-gray-700 hover:text-blue-600">위치</a>
                    <a href="/schedule" className="text-gray-700 hover:text-blue-600">스케줄</a>
                    <AuthHeader />
                  </div>
                </div>
              </div>
            </nav>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  )
} 
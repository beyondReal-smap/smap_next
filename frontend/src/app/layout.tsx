import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SMAP Next',
  description: 'SMAP Next 웹 애플리케이션',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  )
} 
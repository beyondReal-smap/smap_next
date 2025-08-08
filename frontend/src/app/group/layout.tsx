import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '그룹 관리 - SMAP',
  description: '그룹 생성, 초대, 멤버 관리 기능을 제공합니다.',
  alternates: {
    canonical: '/group',
  },
  openGraph: {
    title: 'SMAP 그룹 관리',
    description: '그룹 생성, 초대, 멤버 관리 기능을 제공합니다.',
    type: 'website',
  },
}

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen group-layout">
      {children}
    </div>
  );
} 
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '../components/layout/AppLayout';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter();
  
  // 실제 구현 시에는 로그인 상태를 확인하는 로직이 필요합니다
  /* 
  useEffect(() => {
    // 로그인 상태 확인 (예: 쿠키, 세션, 토큰 등)
    const isLoggedIn = checkLoginStatus();
    
    if (!isLoggedIn) {
      router.replace('/');
    }
  }, [router]);
  */
  
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
} 
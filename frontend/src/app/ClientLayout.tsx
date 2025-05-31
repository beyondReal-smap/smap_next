'use client';

import React, { useEffect, useState } from 'react';
import { BottomNavBar } from './components/layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);

  // 클라이언트 측에서만 마운트
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; // 서버 사이드 렌더링 중에는 아무것도 렌더링하지 않음
  }

  return (
    <AuthProvider>
      <UserProvider>
        {children}
        <BottomNavBar />
      </UserProvider>
    </AuthProvider>
  );
} 
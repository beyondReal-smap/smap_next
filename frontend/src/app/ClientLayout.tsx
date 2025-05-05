'use client';

import React, { useEffect, useState } from 'react';
import { BottomNavBar } from './components/layout';

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

  return (
    <>
      {children}
      {isMounted && <BottomNavBar />}
    </>
  );
} 
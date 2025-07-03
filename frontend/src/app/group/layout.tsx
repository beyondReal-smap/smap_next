'use client';

import { Suspense } from 'react';
import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<IOSCompatibleSpinner message="로딩 중..." fullScreen />}>
      {children}
    </Suspense>
  );
} 
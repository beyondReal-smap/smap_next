'use client';

import { Suspense } from 'react';
import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';

export default function GroupJoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<IOSCompatibleSpinner message="로딩 중..." fullScreen />}>
      {children}
    </Suspense>
    </div>
  );
} 
'use client';

import { AppLayout } from '../components/layout';
import { Suspense } from 'react';

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AppLayout>{children}</AppLayout>
    </Suspense>
  );
} 
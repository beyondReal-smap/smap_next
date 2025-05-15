'use client';

import { AppLayout } from '../components/layout';
import { Suspense } from 'react';

export default function ScheduleLayout({
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
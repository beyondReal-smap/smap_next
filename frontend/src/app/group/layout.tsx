'use client';

import { AppLayout } from '../components/layout';
import { Suspense } from 'react';

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>{children}</AppLayout>
  );
} 
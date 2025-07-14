'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '../components/layout/AppLayout';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
} 
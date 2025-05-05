'use client';

import { AppLayout } from '../components/layout';

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
} 
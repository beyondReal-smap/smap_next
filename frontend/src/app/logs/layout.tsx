'use client';

import { AppLayout } from '../components/layout';

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
} 
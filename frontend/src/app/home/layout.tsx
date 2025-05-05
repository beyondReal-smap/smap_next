'use client';

import { AppLayout } from '../components/layout';

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
} 
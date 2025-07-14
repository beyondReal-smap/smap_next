'use client';

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen group-layout">
      {children}
    </div>
  );
} 
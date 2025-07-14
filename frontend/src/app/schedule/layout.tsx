'use client';

export default function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen schedule-layout">
      {children}
    </div>
  );
} 
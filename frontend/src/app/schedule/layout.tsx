'use client';

export default function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style jsx global>{`
        .schedule-layout header,
        .schedule-layout .header-fixed,
        .schedule-layout .glass-effect,
        .schedule-layout .schedule-header,
        .schedule-layout [role="banner"] {
          padding-top: 0px !important;
          margin-top: 0px !important;
          top: 0px !important;
        }
        
        .schedule-layout body,
        .schedule-layout html {
          padding-top: 0px !important;
          margin-top: 0px !important;
        }
      `}</style>
      <div className="min-h-screen schedule-layout">
        {children}
      </div>
    </>
  );
} 
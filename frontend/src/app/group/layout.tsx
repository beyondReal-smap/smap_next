'use client';

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style jsx global>{`
        .group-layout header,
        .group-layout .header-fixed,
        .group-layout .glass-effect,
        .group-layout .group-header,
        .group-layout [role="banner"] {
          padding-top: 0px !important;
          margin-top: 0px !important;
          top: 0px !important;
        }
        
        .group-layout body,
        .group-layout html {
          padding-top: 0px !important;
          margin-top: 0px !important;
        }
      `}</style>
      <div className="min-h-screen group-layout">
        {children}
      </div>
    </>
  );
} 
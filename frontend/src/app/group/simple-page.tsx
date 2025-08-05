'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimpleGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">그룹 페이지</h1>
        <p>기본 그룹 페이지입니다.</p>
      </div>
    </div>
  );
} 
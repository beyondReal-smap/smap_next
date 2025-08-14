'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';

export default function ShortUrlPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const token = searchParams.get('t');
    
    if (token) {
      // 토큰이 있으면 reset-password 페이지로 리다이렉트
      router.replace(`/reset-password?token=${token}`);
    } else {
      // 토큰이 없으면 로그인 페이지로 리다이렉트
      router.replace('/signin');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <IOSCompatibleSpinner size="sm" />
        <p className="text-gray-600 text-sm mt-4">페이지를 이동하고 있습니다...</p>
      </div>
    </div>
  );
} 
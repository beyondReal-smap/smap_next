'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { hapticFeedback, triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

export default function SettingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleBack = () => {
    // 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '설정 페이지 뒤로가기', { 
      component: 'setting', 
      action: 'back-navigation' 
    });
    router.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* 고정 헤더 - 애니메이션 없이 안정적 표시 */}
      <header 
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100"
        style={{
          height: '64px',
          minHeight: '64px'
        }}
      >
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">설정</h1>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 - 고정 헤더 높이만큼 패딩 */}
      <main style={{ 
        paddingTop: '64px',
        minHeight: 'calc(100vh - 64px)'
      }}>
        {children}
      </main>
      </div>
  );
} 
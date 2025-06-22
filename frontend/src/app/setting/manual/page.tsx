"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiBook, FiPlay } from 'react-icons/fi';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

const videos = [
  { title: '소개1', url: 'https://www.youtube.com/embed/fRLxsHCvwuQ' },
  { title: '소개2', url: 'https://www.youtube.com/embed/xOqCizxr2uk' },
  { title: '그룹', url: 'https://www.youtube.com/embed/Bvzaz5vFyAo' },
  { title: '일정', url: 'https://www.youtube.com/embed/Ba83-yfjvBQ' },
  { title: '내장소', url: 'https://www.youtube.com/embed/EDcvCwZmF38' },
];

// 모바일 최적화된 CSS 애니메이션
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

@keyframes slideInFromRight {
  from {
    transform: translateX(30px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutToRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-30px);
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.initial-hidden {
  opacity: 0;
  transform: translateX(100%);
  position: relative;
  width: 100%;
  overflow: hidden;
}

/* glass-effect 스타일 - setting 페이지와 동일 */
.glass-effect {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important;
  width: 100% !important;
  height: auto !important;
  transform: none !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: visible !important;
}

/* 혹시 부모 요소가 relative나 다른 포지션인 경우를 위한 추가 스타일 */
body, html {
  position: relative !important;
}

/* 헤더가 잘리지 않도록 보장 */
.glass-effect > * {
  position: relative !important;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}
`;

export default function ManualPage() {
  const router = useRouter();

  // 페이지 마운트 시 스크롤 설정
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  const handleBack = () => {
    // 🎮 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '사용 가이드 뒤로가기', { 
      component: 'manual', 
      action: 'back-navigation' 
    });
    router.back();
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className="schedule-page-container bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* 헤더 - setting 페이지와 동일한 애니메이션 */}
        <motion.header 
          initial={{ y: -100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ 
            delay: 0.2, 
            duration: 0.8, 
            ease: [0.25, 0.46, 0.45, 0.94],
            opacity: { duration: 0.6 },
            scale: { duration: 0.6 }
          }}
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed"
          style={{ position: 'fixed', zIndex: 9999 }}
        >
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center justify-between h-14 px-4"
          >
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBack}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="flex items-center space-x-3"
              >
                <div>
                  <h1 className="text-lg font-bold text-gray-900">사용 가이드</h1>
                  <p className="text-xs text-gray-500">앱 사용법 및 도움말</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.header>

        {/* schedule/page.tsx와 동일한 메인 컨텐츠 구조 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="schedule-page-content px-4 pt-20 space-y-6 pb-6"
        >
          {/* 사용 가이드 정보 카드 - 보라색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="bg-[#A855F7] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <FiBook className="w-8 h-8" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-xl font-bold">사용 가이드</h2>
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      <FiPlay className="w-3 h-3 text-purple-100" />
                      <span className="text-xs font-medium text-purple-100">동영상</span>
                    </div>
                  </div>
                  <p className="text-purple-100 text-sm mb-1">앱 사용법 및 도움말</p>
                  <p className="text-purple-200 text-xs">동영상으로 쉽게 배우는 스케줄맵</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiPlay className="w-4 h-4 text-purple-200" />
                      <span className="text-sm text-purple-100">총 영상</span>
                    </div>
                    <p className="text-lg font-bold">{videos.length}개</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiBook className="w-4 h-4 text-purple-200" />
                      <span className="text-sm text-purple-100">가이드</span>
                    </div>
                    <p className="text-lg font-bold">무료</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          {/* 동영상 목록 */}
          {videos.map((video, idx) => (
            <motion.div 
              key={video.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (0.1 * idx), duration: 0.6 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-3">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <FiPlay className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{video.title}</h3>
                    <p className="text-xs text-gray-500">동영상 가이드</p>
                  </div>
                </div>
                
                <div className="w-full rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={video.url}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-48 border-none"
                    style={{ aspectRatio: '16/9' }}
                  />
                </div>
              </div>
            </motion.div>
          ))}

          {/* 추가 도움말 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-4"
          >
            <h3 className="text-sm font-bold text-gray-900 mb-2">추가 도움이 필요하신가요?</h3>
            <p className="text-xs text-gray-600 mb-3">
              동영상 가이드로 해결되지 않는 문제가 있으시면 언제든지 문의해 주세요.
            </p>
            <motion.button
              onClick={() => router.push('/setting/inquiry')}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg py-2 text-xs font-medium mobile-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              1:1 문의하기
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
} 
"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiBell } from 'react-icons/fi';
import AnimatedHeader from '../../../components/common/AnimatedHeader';

export default function NoticeTestPage() {
  const router = useRouter();

  // 페이지 마운트 시 스크롤 설정 (manual 페이지와 동일한 방식)
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  return (
    <div 
      className="fixed inset-0 overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50"
    >
      <AnimatedHeader 
        variant="simple"
        className="fixed top-0 left-0 right-0 z-50 glass-effect"
        style={{ 
            zIndex: 2147483647,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
        }}
      >
        <div className="flex items-center justify-between h-14 px-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center space-x-3"
            >
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <FiChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">공지사항 (테스트)</h1>
                <p className="text-xs text-gray-500">헤더 고정 테스트</p>
              </div>
            </motion.div>
        </div>
      </AnimatedHeader>
        
      <main 
        className="absolute inset-0 pt-20 px-4 pb-6 space-y-6 overflow-y-auto"
      >
        <p>스크롤 테스트를 위한 콘텐츠입니다.</p>
        <div style={{ height: '200vh', background: 'repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 10px, #e0e0e0 10px, #e0e0e0 20px)' }}>
            <p className="pt-40 text-center font-bold">페이지 하단</p>
        </div>
      </main>
    </div>
  );
} 
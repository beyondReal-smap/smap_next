import React from 'react';
import { motion } from 'framer-motion';
import IOSCompatibleSpinner from './IOSCompatibleSpinner';

interface TermsPageLoadingProps {
  message?: string;
  subMessage?: string;
}

export default function TermsPageLoading({ 
  message = "페이지 로딩 중...", 
  subMessage = "잠시만 기다려주세요" 
}: TermsPageLoadingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
      <motion.div 
        className="bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 max-w-md mx-4"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="text-center">
          {/* iOS 호환 로딩 스피너 */}
          <div className="mb-6">
            <IOSCompatibleSpinner size="lg" />
          </div>
          
          {/* 메인 메시지 */}
          <motion.h2 
            className="text-xl font-semibold text-gray-700 mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {message}
          </motion.h2>
          
          {/* 서브 메시지 */}
          <motion.p 
            className="text-gray-500 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {subMessage}
          </motion.p>
          
          {/* 추가 인디케이터 */}
          <motion.div 
            className="flex justify-center space-x-1 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <motion.div 
              className="w-2 h-2 bg-indigo-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
            />
            <motion.div 
              className="w-2 h-2 bg-indigo-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div 
              className="w-2 h-2 bg-indigo-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

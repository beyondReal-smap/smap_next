'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onComplete, 
  duration = 3000 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // 페이드아웃 애니메이션 완료 후 콜백 실행
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999,
          }}
        >
          {/* 배경 애니메이션 */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #00f2fe)',
                backgroundSize: '400% 400%',
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </div>

          {/* 로고 및 텍스트 */}
          <div className="relative z-10 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.8,
                delay: 0.2,
                type: 'spring',
                stiffness: 200,
                damping: 20
              }}
              className="mb-6 flex items-center justify-center"
            >
              <div className="relative">
                <Image
                  src="/images/smap_logo.webp"
                  alt="SMAP Logo"
                  width={80}
                  height={80}
                  // className="shadow-2xl"
                  priority
                  style={{
                    mixBlendMode: 'multiply',
                    filter: 'brightness(1.1) contrast(1.1)'
                  }}
                />
              </div>

              <motion.h1
                className="text-4xl font-bold text-white"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.4,
                  type: 'spring',
                  stiffness: 200,
                  damping: 20
                }}
              >
                SMAP
              </motion.h1>
            </motion.div>

            <motion.p
              className="text-white/80 text-lg -mt-7"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.8,
                delay: 0.6,
                type: 'spring',
                stiffness: 200,
                damping: 20
              }}
            >
              스케줄기반 위치 공유 서비스
            </motion.p>

            {/* 로딩 인디케이터 - 회전하는 원형 스피너 */}
            {/* <motion.div
              className="mt-8 flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <div className="relative w-8 h-8">
                <motion.div
                  className="absolute inset-0 border-2 border-white/30 rounded-full"
                />
                <motion.div
                  className="absolute inset-0 border-2 border-transparent border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </div>
            </motion.div> */}
          </div>

          {/* 하단 텍스트 */}
          <motion.div
            className="absolute bottom-8 left-0 right-0 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            <p className="text-white/100 text-sm">
              © 2025 SMAP. All rights reserved.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen; 
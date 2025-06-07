"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiBook, FiPlay } from 'react-icons/fi';

const videos = [
  { title: '소개1', url: 'https://www.youtube.com/embed/fRLxsHCvwuQ' },
  { title: '소개2', url: 'https://www.youtube.com/embed/xOqCizxr2uk' },
  { title: '그룹', url: 'https://www.youtube.com/embed/Bvzaz5vFyAo' },
  { title: '일정', url: 'https://www.youtube.com/embed/Ba83-yfjvBQ' },
  { title: '내장소', url: 'https://www.youtube.com/embed/EDcvCwZmF38' },
];

export default function ManualPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 400);
  };

  return (
    <>
      <style jsx global>{`
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
        }

        .glass-effect {
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.7);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
        }
      `}</style>
      
      <div className={`bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen pb-10 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isPageLoaded) ? 'animate-slideInFromRight' : 
        shouldAnimate ? 'initial-hidden' : ''
      }`} style={{ 
        position: 'relative',
        width: '100%',
        overflow: shouldAnimate && !isPageLoaded ? 'hidden' : 'visible'
      }}>
        {/* 개선된 헤더 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-50 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBack}
                disabled={isExiting}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div className="flex items-center space-x-3">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  className="p-2 bg-purple-600 rounded-xl"
                >
                  <FiBook className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">사용 가이드</h1>
                  <p className="text-xs text-gray-500">앱 사용법 및 도움말</p>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* 메인 콘텐츠 */}
        <div className="px-4 pt-20 pb-6">
          <div className="space-y-6">
            {videos.map((video, idx) => (
              <motion.div 
                key={video.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx, duration: 0.5 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <FiPlay className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{video.title}</h3>
                      <p className="text-sm text-gray-500">동영상 가이드</p>
                    </div>
                  </div>
                  
                  <div className="aspect-w-16 aspect-h-9 w-full rounded-xl overflow-hidden bg-black">
                    <iframe
                      src={video.url}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-56 rounded-xl border-none"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
} 
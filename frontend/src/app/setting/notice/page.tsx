'use client';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiBell, FiCalendar } from 'react-icons/fi';

// 공지사항 mock 데이터
const MOCK_NOTICES = [
  {
    id: 1,
    title: '서비스 점검 안내',
    date: '2024-06-10',
    content: '6월 12일(수) 02:00~04:00 서비스 점검이 예정되어 있습니다. 이용에 참고 부탁드립니다.'
  },
  {
    id: 2,
    title: '신규 기능 업데이트',
    date: '2024-05-28',
    content: '그룹 관리 기능이 추가되었습니다. 자세한 내용은 공지사항을 확인해 주세요.'
  },
  // 공지 없을 때는 빈 배열로 테스트 가능
];

export default function NoticePage() {
  const router = useRouter();
  const [notices, setNotices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 공지사항 데이터 로딩 시뮬레이션
  useEffect(() => {
    const fetchNotices = async () => {
      setIsLoading(true);
      try {
        // 실제 API 호출 시뮬레이션 (2초 지연)
        await new Promise(resolve => setTimeout(resolve, 2000));
        setNotices(MOCK_NOTICES);
      } catch (error) {
        console.error('공지사항 로딩 실패:', error);
        setNotices([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotices();
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

        .card-hover {
          transition: all 0.3s ease;
        }

        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
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
                  className="p-2 bg-red-600 rounded-xl"
                >
                  <FiBell className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">공지사항</h1>
                  <p className="text-xs text-gray-500">최신 소식 및 업데이트</p>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* 로딩 오버레이 - home/page.tsx 스타일 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-40" style={{backgroundColor: '#ffffff'}}>
            <div className="bg-white rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center space-y-4 max-w-xs mx-4">
              {/* 스피너 */}
              <div className="relative">
                <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
                <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-red-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
              </div>
              
              {/* 로딩 텍스트 */}
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 mb-1">
                  공지사항을 불러오는 중...
                </p>
                <p className="text-sm text-gray-600">
                  잠시만 기다려주세요
                </p>
              </div>
              
              {/* 진행 표시 점들 */}
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <div className="px-4 pt-20 pb-6">
          {!isLoading && (
            <>
              {notices.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex flex-col items-center justify-center py-24 text-gray-400"
                >
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <FiBell className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="text-lg font-medium text-gray-600">등록된 공지사항이 없습니다.</div>
                  <p className="text-sm text-gray-500 mt-2">새로운 소식이 있으면 알려드릴게요</p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {notices.map((notice, idx) => (
                    <motion.div
                      key={notice.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * idx, duration: 0.5 }}
                    >
                      <Link href={`/setting/notice/${notice.id}`} className="block">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 card-hover">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                                <FiBell className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-bold text-base text-gray-900 mb-1">{notice.title}</h3>
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                  <FiCalendar className="w-3 h-3" />
                                  <span>{notice.date}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-gray-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{notice.content}</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
} 
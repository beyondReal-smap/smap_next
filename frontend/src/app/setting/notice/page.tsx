'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiBell, FiCalendar } from 'react-icons/fi';

// 공지사항 인터페이스
interface Notice {
  nt_idx: number;
  nt_title: string;
  nt_content: string;
  nt_hit: number;
  nt_wdate: string;
}

interface NoticeListResponse {
  notices: Notice[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// API 호출 함수
const fetchNotices = async (page: number = 1, size: number = 20): Promise<NoticeListResponse> => {
  try {
    const response = await fetch(`/api/v1/notices?page=${page}&size=${size}&show_only=true`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('공지사항 API 호출 실패:', error);
    throw error;
  }
};

// 날짜 포맷팅 함수
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1);
  } catch (error) {
    return dateString;
  }
};

// 내용 요약 함수 (100자 제한)
const truncateContent = (content: string, maxLength: number = 100): string => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
};

// 모바일 최적화된 CSS 애니메이션 (setting 페이지와 동일)
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

@keyframes slideInFromBottom {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideOutToBottom {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
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

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-slideOutToBottom {
  animation: slideOutToBottom 0.3s ease-in forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}

.initial-hidden {
  opacity: 0;
  transform: translateX(100%);
  position: relative;
  width: 100%;
  overflow: hidden;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.glass-effect {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  background: rgba(255, 255, 255, 0.8) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important;
  width: 100% !important;
  height: auto !important;
  transform: none !important;
  -webkit-transform: none !important;
  -moz-transform: none !important;
  -ms-transform: none !important;
  -o-transform: none !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: visible !important;
  will-change: auto !important;
  backface-visibility: visible !important;
  -webkit-backface-visibility: visible !important;
  -webkit-perspective: none !important;
  perspective: none !important;
}

.menu-item-hover {
  transition: all 0.2s ease;
}

.menu-item-hover:hover {
  transform: translateX(4px);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.card-hover {
  transition: all 0.2s ease;
}

.card-hover:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

body, html {
  word-break: keep-all;
}
`;

export default function NoticePage() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // 페이지 마운트 시 스크롤 설정
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  // 공지사항 데이터 로딩
  useEffect(() => {
    const loadNotices = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await fetchNotices(1, 20);
        setNotices(data.notices);
        setTotalCount(data.total);
      } catch (error) {
        console.error('공지사항 로딩 실패:', error);
        setError('공지사항을 불러오는데 실패했습니다.');
        setNotices([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotices();
  }, []);

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className="schedule-page-container bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* 헤더 - setting 페이지와 완전히 동일한 구조 */}
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
          className="fixed top-0 left-0 right-0 z-20 glass-effect"
          data-fixed="true"
        >
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center justify-between h-16 px-4"
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
                  <h1 className="text-lg font-bold text-gray-900">공지사항</h1>
                  <p className="text-xs text-gray-500">최신 소식 및 업데이트</p>
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
          className="schedule-page-content px-4 pt-20 space-y-6"
        >
          {/* 공지사항 정보 카드 - 빨간색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="bg-[#EF4444] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <FiBell className="w-8 h-8" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-xl font-bold">공지사항</h2>
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      <FiCalendar className="w-3 h-3 text-red-100" />
                      <span className="text-xs font-medium text-red-100">최신 소식</span>
                    </div>
                  </div>
                  <p className="text-red-100 text-sm mb-1">최신 소식 및 업데이트</p>
                  <p className="text-red-200 text-xs">중요한 공지사항을 확인하세요</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiBell className="w-4 h-4 text-red-200" />
                      <span className="text-sm text-red-100">총 공지</span>
                    </div>
                    <p className="text-lg font-bold">{isLoading ? '...' : `${totalCount}개`}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiCalendar className="w-4 h-4 text-red-200" />
                      <span className="text-sm text-red-100">업데이트</span>
                    </div>
                    <p className="text-lg font-bold">정기</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 로딩 상태 */}
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* 메인 컨텐츠 */}
          {!isLoading && (
            <>
              {notices.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="flex flex-col items-center justify-center py-16 text-gray-400"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <FiBell className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-base font-medium text-gray-600">등록된 공지사항이 없습니다</div>
                  <p className="text-xs text-gray-500 mt-1">새로운 소식이 있으면 알려드릴게요</p>
                </motion.div>
              ) : (
                <>
                  {/* 에러 상태 표시 */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.6 }}
                      className="bg-red-50 rounded-2xl p-4 mb-4"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-red-900">오류 발생</h3>
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* 공지사항 목록 */}
                  <div className="space-y-3">
                    {notices.map((notice, idx) => (
                      <motion.div
                        key={notice.nt_idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + (0.1 * idx), duration: 0.6 }}
                      >
                        <Link href={`/setting/notice/${notice.nt_idx}`} className="block">
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 card-hover mobile-button">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-base text-gray-900 mb-2 line-clamp-1">{notice.nt_title}</h3>
                                  <div className="flex items-center space-x-3 text-sm text-gray-500 mb-2">
                                    <div className="flex items-center space-x-1">
                                      <FiCalendar className="w-4 h-4" />
                                      <span>{formatDate(notice.nt_wdate)}</span>
                                    </div>
                                    <span className="text-gray-400">•</span>
                                    <span>조회 {notice.nt_hit}회</span>
                                  </div>
                                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{truncateContent(notice.nt_content)}</p>
                                </div>
                              </div>
                              <div className="text-gray-400 ml-3">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      </div>
    </>
  );
} 
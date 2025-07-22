'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiCalendar, FiChevronLeft } from 'react-icons/fi';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import AnimatedHeader from '../../../components/common/AnimatedHeader';

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

// 모바일 최적화된 CSS 애니메이션 (setting 페이지와 통일)
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
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

@keyframes slideInFromLeft {
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromBottom {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
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

/* notice 페이지 컨텐츠 애니메이션 */
.notice-content {
  opacity: 0;
  animation: fadeIn 0.5s ease-out forwards;
}

.notice-content:nth-child(1) { animation-delay: 0.1s; }
.notice-content:nth-child(2) { animation-delay: 0.2s; }
.notice-content:nth-child(3) { animation-delay: 0.3s; }
.notice-content:nth-child(4) { animation-delay: 0.4s; }
.notice-content:nth-child(5) { animation-delay: 0.5s; }

/* 시머 애니메이션 */
@keyframes shimmer {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

@keyframes shimmerMove {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 로딩 중일 때는 애니메이션 비활성화 */
.loading .notice-content {
  opacity: 1;
  animation: none;
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 통일된 애니메이션 */
.unified-animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
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

  // 페이지 마운트 시 body, html 스타일 초기화 (헤더 고정을 위해 필요)
  useEffect(() => {
    document.body.setAttribute('data-page', '/setting/notice');
    document.body.classList.add('notice-page-active');
    
    // body, html 스타일 강제 초기화 (헤더 고정을 위해 필요)
    document.body.style.position = 'static';
    document.body.style.overflow = 'visible';
    document.body.style.transform = 'none';
    document.body.style.willChange = 'auto';
    document.body.style.perspective = 'none';
    document.body.style.backfaceVisibility = 'visible';
    document.documentElement.style.position = 'static';
    document.documentElement.style.overflow = 'visible';
    document.documentElement.style.transform = 'none';
    document.documentElement.style.willChange = 'auto';
    document.documentElement.style.perspective = 'none';
    document.documentElement.style.backfaceVisibility = 'visible';
    
    return () => {
      document.body.removeAttribute('data-page');
      document.body.classList.remove('notice-page-active');
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
    // 🎮 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '공지사항 뒤로가기', { 
      component: 'notice', 
      action: 'back-navigation' 
    });
    router.back();
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div 
        className="fixed inset-0 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container"
        id="setting-inquiry2-page-container"
        style={{
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
        {/* 통일된 헤더 애니메이션 - setting 페이지와 동일 */}
        <AnimatedHeader 
          variant="simple"
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed inquiry2-header"
          style={{ 
            paddingTop: '0px',
            marginTop: '0px',
            top: '0px',
            position: 'fixed',
            zIndex: 2147483647,
            left: '0px',
            right: '0px',
            width: '100vw',
            height: '56px',
            minHeight: '56px',
            maxHeight: '56px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
            boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0',
            margin: '0',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: 'transform',
            visibility: 'visible',
            opacity: '1',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'manipulation',
            pointerEvents: 'auto'
          }}
        >
          <div className="flex items-center justify-between h-full px-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center space-x-3"
            >
              <motion.button 
                onClick={handleBack}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">공지사항</h1>
                <p className="text-xs text-gray-500">최신 소식을 확인하세요</p>
              </div>
            </motion.div>
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </AnimatedHeader>
        
        {/* 메인 컨텐츠 - 고정 위치 (setting 페이지와 동일한 구조) */}
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          className="absolute inset-0 px-4 space-y-6 overflow-y-auto content-area pt-20"
          style={{ 
            top: '0px',
            bottom: '0px',
            left: '0',
            right: '0'
          }}
        >
          {/* 공지사항 정보 카드 - 빨간색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="notice-content"
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
              className="space-y-3 notice-content"
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
                  className="flex flex-col items-center justify-center py-16 text-gray-400 notice-content"
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
                      className="bg-red-50 rounded-2xl p-4 mb-4 notice-content"
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
                        className="notice-content"
                      >
                        <Link 
                          href={`/setting/notice/${notice.nt_idx}`} 
                          className="block"
                          onClick={() => {
                            // 🎮 공지사항 상세 진입 햅틱 피드백
                            triggerHapticFeedback(HapticFeedbackType.SELECTION, '공지사항 상세 진입', { 
                              component: 'notice', 
                              action: 'view-detail',
                              noticeId: notice.nt_idx 
                            });
                          }}
                        >
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
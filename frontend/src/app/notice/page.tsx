'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiBell, FiChevronRight, FiClock, FiStar } from 'react-icons/fi';
import { PushLog } from '@/types/push';
import notificationService from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import AnimatedHeader from '../../components/common/AnimatedHeader';

// 날짜별 그룹핑 함수
function groupByDate(list: PushLog[]): Record<string, PushLog[]> {
  return list.reduce((acc: Record<string, PushLog[]>, item: PushLog) => {
    const date = item.plt_sdate.slice(0, 10); // 'YYYY-MM-DD'
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
}

// 모바일 최적화된 CSS 애니메이션
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: static !important;
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-30px);
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

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
  }
}

.animate-slideInFromLeft {
  animation: slideInFromLeft 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.5s ease-out forwards;
}

.animate-fadeInScale {
  animation: fadeInScale 0.4s ease-out forwards;
}

.animate-pulseGlow {
  animation: pulseGlow 2s infinite;
}

.glass-effect {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

.notice-item {
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform: translateX(0);
}

.notice-item:hover {
  transform: translateX(4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.notice-item:active {
  transform: scale(0.98) translateX(2px);
}

.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
`;

export default function NoticePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [notices, setNotices] = useState<PushLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const dataFetchedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 안정적인 데이터 로딩 함수
  const loadNotices = useCallback(async (userId: number) => {
    // 이전 요청이 있다면 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 새로운 AbortController 생성
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await notificationService.getMemberPushLogs(userId.toString());
      
      // 요청이 취소되었는지 확인
      if (abortControllerRef.current.signal.aborted) {
        return;
      }
      
      if (data && Array.isArray(data)) {
        // 읽지 않은 알림이 있으면 모두 읽음 처리
        const unreadNotifications = data.filter(notification => notification.plt_read_chk === 'N');
        if (unreadNotifications.length > 0) {
          try {
            await notificationService.markAllAsRead(userId);
            
            // 읽음 처리 후 데이터 다시 가져오기
            const updatedData = await notificationService.getMemberPushLogs(userId.toString());
            
            // 요청이 취소되었는지 다시 확인
            if (abortControllerRef.current.signal.aborted) {
              return;
            }
            
            setNotices(Array.isArray(updatedData) ? updatedData : []);
          } catch (error) {
            console.error('[NOTICE PAGE] 읽음 처리 실패:', error);
            setNotices(data);
          }
        } else {
          setNotices(data);
        }
      } else {
        setNotices([]);
      }
      
      setIsInitialized(true);
      dataFetchedRef.current = true;
      
      // 데이터 로딩 완료 햅틱 피드백
      triggerHapticFeedback(HapticFeedbackType.SUCCESS, '알림 데이터 로딩 완료', { 
        component: 'notice', 
        action: 'data-load-complete' 
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // 취소된 요청은 무시
      }
      
      console.error('[NOTICE PAGE] Error fetching notices:', error);
      setError('알림을 불러오는 중 오류가 발생했습니다.');
      setNotices([]);
      setIsInitialized(true);
      dataFetchedRef.current = true;
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // 공지사항 데이터 로드
  useEffect(() => {
    if (!user?.mt_idx) {
      return;
    }
    
    // 이미 초기화되었으면 다시 로드하지 않음
    if (isInitialized && dataFetchedRef.current) {
      return;
    }
    
    loadNotices(user.mt_idx);
    
    // 컴포넌트 언마운트 시 요청 취소
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user?.mt_idx, loadNotices, isInitialized]);

  // 헤더 위 여백 강제 제거 (group/schedule과 동일)
  useEffect(() => {
    const selectors = [
      'header',
      '.header-fixed',
      '.glass-effect',
      '.group-header',
      '.register-header-fixed',
              '.activelog-header',
      '.location-header',
      '.schedule-header',
      '.home-header',
      '[role="banner"]',
      '#notice-page-container'
    ];
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.paddingTop = '0px';
        htmlElement.style.marginTop = '0px';
        htmlElement.style.setProperty('padding-top', '0px', 'important');
        htmlElement.style.setProperty('margin-top', '0px', 'important');
        if (selector === 'header' || selector.includes('header')) {
          htmlElement.style.setProperty('top', '0px', 'important');
          htmlElement.style.setProperty('position', 'fixed', 'important');
          htmlElement.style.setProperty('height', '64px', 'important');
        }
      });
    });
    
    document.body.style.setProperty('padding-top', '0px', 'important');
    document.body.style.setProperty('margin-top', '0px', 'important');
    document.documentElement.style.setProperty('padding-top', '0px', 'important');
    document.documentElement.style.setProperty('margin-top', '0px', 'important');
  }, []);

  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.LIGHT);
    // 뒤로가기 버튼 클릭 시 홈으로 강제 이동
    console.log('[NOTICE PAGE] 뒤로가기 버튼 클릭 - 홈으로 이동');
    
    // 즉시 window.location으로 강제 이동
    window.location.href = '/home';
  };

  const handleNoticeClick = (notice: PushLog) => {
    try {
      triggerHapticFeedback(HapticFeedbackType.LIGHT);
      router.push(`/notice/${notice.plt_idx}`);
    } catch (error) {
      console.error('[NOTICE PAGE] Notice click error:', error);
    }
  };

  // 날짜별 그룹핑 및 정렬
  const sorted = notices && Array.isArray(notices) ? [...notices].sort((a, b) => new Date(b.plt_sdate).getTime() - new Date(a.plt_sdate).getTime()) : [];
  const grouped = groupByDate(sorted);

  // 안전한 렌더링을 위한 조건부 체크
  if (!user || !user.mt_idx) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
            <FiBell className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-gray-500">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* 고정 헤더 (group 페이지와 동일한 스타일) */}
        <AnimatedHeader
          variant="simple"
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed notice-header"
          style={{ 
            paddingTop: '0px',
            marginTop: '0px',
            top: '0px',
            position: 'fixed',
            height: '64px'
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">알림</h1>
                <p className="text-xs text-gray-500">최신 소식을 확인하세요</p>
              </div>
            </motion.div>
          </div>
        </AnimatedHeader>

        {/* 스크롤 가능한 메인 컨텐츠 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="px-4 space-y-6 pb-24 min-h-screen"
          style={{ paddingTop: '40px' }}
        >
          {loading || !isInitialized ? (
            /* 스켈레톤 로딩 */
            <div className="space-y-6 mt-6">
              {[1, 2, 3].map((sectionIndex) => (
                <motion.div
                  key={sectionIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sectionIndex * 0.1, duration: 0.5 }}
                  className="relative"
                >
                  {/* 날짜 헤더 스켈레톤 */}
                  <div className="mb-5">
                    <div className="bg-gray-200 rounded-lg px-4 py-2 mx-2 animate-pulse">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                        <div className="h-4 bg-gray-300 rounded w-24"></div>
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* 알림 카드 스켈레톤 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mx-2 overflow-hidden">
                    {[1, 2, 3].map((itemIndex) => (
                      <div 
                        key={itemIndex}
                        className={`flex items-start p-4 animate-pulse ${
                          itemIndex !== 3 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full mr-3 mt-0.5"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-12 ml-2"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-full"></div>
                            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
              
              {/* 로딩 메시지 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-center py-8"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                  <FiBell className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-gray-500 text-sm">알림을 불러오는 중...</p>
              </motion.div>
            </div>
          ) : error ? (
            /* 에러 상태 */
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiBell className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setIsInitialized(false);
                  dataFetchedRef.current = false;
                  if (user?.mt_idx) {
                    loadNotices(user.mt_idx);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : (
            /* 알림 목록 - 날짜별 그룹핑 */
            <div className="space-y-6">
              {Object.entries(grouped).map(([date, items], sectionIndex) => (
                <section key={date} className="relative">
                  {/* 날짜 헤더 - 스크롤 시 고정 */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="sticky top-16 z-[8] mb-5"
                    style={{ 
                      top: '64px', // 헤더 높이만큼 아래에 고정
                      zIndex: 8,
                      position: 'sticky'
                    }}
                  >
                    <div className="bg-gray-900 backdrop-blur-md rounded-lg px-4 py-2 mx-2 shadow-sm border border-gray-800 text-white transition-all duration-300">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                        <span className="text-sm font-semibold text-white">
                          {format(new Date(date), 'MM월 dd일 (E)', { locale: ko })}
                        </span>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </motion.div>

                  {/* 알림 카드들 */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: sectionIndex * 0.1 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200/50 mx-2 overflow-hidden"
                  >
                    {items.map((item, index) => (
                      <motion.div 
                        key={item.plt_idx} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className={`flex items-start p-4 transition-colors cursor-pointer ${
                          index !== items.length - 1 ? 'border-b border-gray-200' : ''
                        } hover:bg-gray-50/50 active:bg-gray-100/50`}
                        onClick={() => handleNoticeClick(item)}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center mr-3 mt-0.5">
                          <span className="text-lg">
                            {item.plt_title.match(/\p{Extended_Pictographic}/u)?.[0] || '📢'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight pr-2">
                              {item.plt_title.replace(/\p{Extended_Pictographic}/u, '').trim()}
                            </h3>
                            <time className="text-xs text-blue-400 font-medium flex-shrink-0">
                              {format(new Date(item.plt_sdate), 'a h:mm', { locale: ko })}
                            </time>
                          </div>
                          <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">
                            {item.plt_content}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </section>
              ))}
              
              {notices.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiBell className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">알림이 없습니다</h3>
                  <p className="text-gray-500">새로운 알림이 도착하면 여기에 표시됩니다.</p>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
} 
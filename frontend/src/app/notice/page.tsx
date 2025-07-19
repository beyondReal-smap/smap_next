'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiBell, FiChevronLeft } from 'react-icons/fi';
import dynamic from 'next/dynamic';
import { PushLog } from '@/types/push';
import notificationService from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

// Dynamic Imports for better code splitting
const AnimatedHeader = dynamic(() => import('@/components/common/AnimatedHeader'), {
  loading: () => null,
  ssr: false
});

// 날짜별 그룹핑 함수
function groupByDate(list: PushLog[]): Record<string, PushLog[]> {
  return list.reduce((acc: Record<string, PushLog[]>, item: PushLog) => {
    // plt_sdate가 없거나 유효하지 않은 경우 '기타' 그룹으로 분류
    if (!item.plt_sdate || typeof item.plt_sdate !== 'string') {
      const date = '기타';
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    }
    
    const date = item.plt_sdate.slice(0, 10); // 'YYYY-MM-DD'
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
}

    export default function NoticePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [notices, setNotices] = useState<PushLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 디버깅을 위한 상태 로그
  useEffect(() => {
    console.log('[NOTICE PAGE] 상태 변경:', { loading, error, noticesCount: notices.length });
  }, [loading, error, notices.length]);

  // 페이지 로드 시 body에 data-page 속성 추가 및 position fixed 해제
  useEffect(() => {
    document.body.setAttribute('data-page', '/notice');
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
      
      console.log('[NOTICE PAGE] 데이터 로딩 시작:', userId);
      const data = await notificationService.getMemberPushLogs(userId.toString());
      
      // 요청이 취소되었는지 확인
      if (abortControllerRef.current.signal.aborted) {
        console.log('[NOTICE PAGE] 요청 취소됨');
        return;
      }
      
      console.log('[NOTICE PAGE] 데이터 로딩 완료:', data);
      
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
      
      console.log('[NOTICE PAGE] notices 상태 설정 완료:', data?.length || 0);
      
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
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        console.log('[NOTICE PAGE] 로딩 상태 false로 설정');
        setLoading(false);
      } else {
        console.log('[NOTICE PAGE] 요청이 취소되어 로딩 상태 변경 안함');
      }
    }
  }, []);

  // 공지사항 데이터 로드
  useEffect(() => {
    if (!user?.mt_idx) {
      return;
    }
    
    // 사용자가 있으면 로딩 시작
    setLoading(true);
    loadNotices(user.mt_idx);
    
    // 컴포넌트 언마운트 시 요청 취소
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user?.mt_idx, loadNotices]);

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
  const sorted = notices && Array.isArray(notices) ? [...notices].sort((a, b) => {
    // plt_sdate가 없는 경우를 처리
    if (!a.plt_sdate || !b.plt_sdate) {
      if (!a.plt_sdate && !b.plt_sdate) return 0;
      if (!a.plt_sdate) return 1; // a가 뒤로
      if (!b.plt_sdate) return -1; // b가 뒤로
    }
    
    try {
      return new Date(b.plt_sdate).getTime() - new Date(a.plt_sdate).getTime();
    } catch (error) {
      console.error('[NOTICE PAGE] 날짜 정렬 오류:', error, { a: a.plt_sdate, b: b.plt_sdate });
      return 0;
    }
  }) : [];
  const grouped = groupByDate(sorted);



  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 notice-page-active" 
      style={{ 
        WebkitOverflowScrolling: 'touch',
        paddingTop: '0px',
        marginTop: '0px',
        top: '0px',
        position: 'static',
        overflow: 'visible',
        transform: 'none',
        willChange: 'auto'
      }}
    >
      {/* 통일된 헤더 애니메이션 */}
      <AnimatedHeader 
        variant="simple"
        className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed notice-header"
        style={{ 
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px',
          position: 'fixed',
          zIndex: 2147483647,
          left: '0px',
          right: '0px',
          width: '100vw'
        }}
      >
        <div className="flex items-center justify-between h-14 px-4">
          <AnimatePresence mode="wait">
            <motion.div 
              key="notice-header"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
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
            <h1 className="text-lg font-bold text-gray-900">알림</h1>
            <p className="text-xs text-gray-500">최신 소식을 확인하세요</p>
              </div>
            </motion.div>
          </AnimatePresence>
          
          <div className="flex items-center space-x-2">
            {/* 필요시 추가 버튼들을 여기에 배치 */}
          </div>
        </div>
      </AnimatedHeader>

      {/* 메인 컨텐츠 */}
      <main className="px-4 space-y-6 pb-24 notice-main-content" style={{ paddingTop: '7px' }}>
        {!user?.mt_idx ? (
          /* 사용자 정보 로딩 중 */
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
              <FiBell className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-gray-500">사용자 정보를 불러오는 중...</p>
          </div>
        ) : loading ? (
          /* 스켈레톤 로딩 */
          <div className="space-y-6 mt-2">
            {[1, 2, 3].map((sectionIndex) => (
              <div key={sectionIndex} className="relative">
                {/* 날짜 헤더 스켈레톤 */}
                <div className="mb-5">
                  <div className="sticky bg-gray-800 rounded-xl mx-4 p-3" style={{ zIndex: 40, top: '71px' }}>
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
              </div>
            ))}
            
            {/* 로딩 메시지 */}
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <FiBell className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-gray-500 text-sm">알림을 불러오는 중...</p>
            </div>
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
                setLoading(true);
                if (user?.mt_idx) {
                  loadNotices(user.mt_idx);
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : notices.length > 0 ? (
          /* 알림 목록 - 날짜별 그룹핑 */
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items], sectionIndex) => (
              <section key={date} className="relative">
                {/* 날짜 헤더 - Sticky 고정 */}
                <div className="sticky bg-gray-800 rounded-xl mx-4 p-3 mb-4 notice-date-header" style={{ zIndex: 40, top: '71px' }}>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-white">
                      {date === '기타' ? '기타' : format(new Date(date), 'MM월 dd일 (E)', { locale: ko })}
                    </span>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* 알림 카드들 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 mx-2 overflow-hidden">
                  {items.map((item, index) => (
                    <div 
                      key={item.plt_idx} 
                      className={`flex items-start p-4 transition-colors cursor-pointer ${
                        index !== items.length - 1 ? 'border-b border-gray-200' : ''
                      } hover:bg-gray-50/50 active:bg-gray-100/50`}
                      onClick={() => handleNoticeClick(item)}
                    >
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center mr-3 mt-0.5">
                        <span className="text-lg">
                          {item.plt_title && typeof item.plt_title === 'string' 
                            ? item.plt_title.match(/\p{Extended_Pictographic}/u)?.[0] || '📢'
                            : '📢'
                          }
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm leading-tight pr-2">
                            {item.plt_title && typeof item.plt_title === 'string'
                              ? item.plt_title.replace(/\p{Extended_Pictographic}/u, '').trim()
                              : '제목 없음'
                            }
                          </h3>
                          <time className="text-xs text-blue-400 font-medium flex-shrink-0">
                            {item.plt_sdate ? format(new Date(item.plt_sdate), 'a h:mm', { locale: ko }) : '시간 없음'}
                          </time>
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">
                          {item.plt_content || '내용 없음'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          /* 알림이 없는 경우 */
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiBell className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">알림이 없습니다</h3>
                <p className="text-gray-500">새로운 알림이 도착하면 여기에 표시됩니다.</p>
              </div>
            )}
      </main>
    </div>
  );
} 
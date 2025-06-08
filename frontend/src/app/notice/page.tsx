'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { PushLog, DeleteAllResponse } from '@/types/push';
import { useToast } from '@/components/ui/use-toast';
import notificationService from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';

// glass-effect 및 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
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

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

/* glass-effect 스타일 추가 */
.glass-effect {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}
`;

// 날짜별 그룹핑 함수
function groupByDate(list: PushLog[]): Record<string, PushLog[]> {
  return list.reduce((acc: Record<string, PushLog[]>, item: PushLog) => {
    const date = item.plt_sdate.slice(0, 10); // 'YYYY-MM-DD'
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
}

function NoticeContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [notices, setNotices] = useState<PushLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentStickyDate, setCurrentStickyDate] = useState<string>('');
  const [showStickyDate, setShowStickyDate] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const dataFetchedRef = React.useRef(false);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lastScrollY = useRef(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 디바운싱된 날짜 업데이트 함수
  const updateStickyDate = useCallback((newDate: string) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      if (newDate !== currentStickyDate) {
        setCurrentStickyDate(newDate);
        setShowStickyDate(true);
      }
    }, 150); // 150ms 디바운싱
  }, [currentStickyDate]);

  // 스크롤 이벤트로 현재 보이는 섹션 감지
  const handleScroll = useCallback(() => {
    if (sectionRefs.current.size === 0) return;

    const headerHeight = 64; // 메인 헤더 높이 (h-16)
    const stickyPosition = 96; // sticky header 위치 (top-24 = 96px)
    const triggerPoint = stickyPosition; // 96px

    const sections = Array.from(sectionRefs.current.entries()).map(([date, element]) => {
      const rect = element.getBoundingClientRect();
      // 각 섹션의 날짜 헤더 위치 (섹션 내부의 첫 번째 div)
      const dateHeaderElement = element.querySelector('div:first-child');
      const dateHeaderRect = dateHeaderElement ? dateHeaderElement.getBoundingClientRect() : rect;
      
      return {
        date,
        element,
        sectionTop: rect.top,
        sectionBottom: rect.bottom,
        dateHeaderTop: dateHeaderRect.top,
        dateHeaderBottom: dateHeaderRect.bottom,
        // 날짜 헤더가 trigger point를 통과했는지 확인
        hasPassedTrigger: dateHeaderRect.top <= triggerPoint,
        // 섹션이 아직 화면에 있는지 확인
        isStillVisible: rect.bottom > triggerPoint,
        // trigger point가 현재 섹션 영역 내부에 있는지 확인
        isCurrentlyActive: rect.top <= triggerPoint && rect.bottom > triggerPoint
      };
    }).sort((a, b) => a.sectionTop - b.sectionTop);

    // 1. 먼저 trigger point가 현재 어떤 섹션 내부에 있는지 확인
    const activeSection = sections.find(section => section.isCurrentlyActive);
    
    if (activeSection) {
      // trigger point가 특정 섹션 내부에 있으면 그 섹션의 날짜 사용
      if (activeSection.date !== currentStickyDate) {
        console.log('[SCROLL] 활성 섹션:', activeSection.date, 'at scrollY:', window.scrollY);
        setCurrentStickyDate(activeSection.date);
        setShowStickyDate(true);
      }
    } else {
      // 2. trigger point가 섹션 사이의 빈 공간에 있는 경우
      // 가장 마지막에 통과한 섹션을 유지 (변경하지 않음)
      const passedSections = sections.filter(section => 
        section.hasPassedTrigger && section.isStillVisible
      );

      if (passedSections.length > 0) {
        const lastPassedSection = passedSections[passedSections.length - 1];
        
        // 현재 날짜가 설정되지 않았거나, 명확히 다른 섹션으로 이동한 경우에만 변경
        if (!currentStickyDate) {
          console.log('[SCROLL] 마지막 통과 섹션 유지:', lastPassedSection.date);
          setCurrentStickyDate(lastPassedSection.date);
          setShowStickyDate(true);
        }
      } else {
        // 3. 아무 섹션도 통과하지 않았다면 첫 번째 섹션
        const firstSection = sections[0];
        if (firstSection && !currentStickyDate) {
          console.log('[SCROLL] 첫 번째 섹션 기본 선택:', firstSection.date);
          setCurrentStickyDate(firstSection.date);
          setShowStickyDate(true);
        }
      }
    }
  }, [currentStickyDate]);

  // 초기 날짜 설정을 위한 별도 useEffect
  useEffect(() => {
    if (notices.length > 0 && !currentStickyDate) {
      // 가장 최근 날짜 찾기
      const sortedNotices = [...notices].sort((a, b) => new Date(b.plt_sdate).getTime() - new Date(a.plt_sdate).getTime());
      if (sortedNotices.length > 0) {
        const latestDate = sortedNotices[0].plt_sdate.slice(0, 10);
        console.log('[STICKY DATE] 초기 설정 - 가장 최근 날짜:', latestDate);
        console.log('[STICKY DATE] 모든 알림 날짜들:', sortedNotices.map(n => n.plt_sdate.slice(0, 10)));
        setCurrentStickyDate(latestDate);
        setShowStickyDate(true);
      }
    }
  }, [notices]);

  // 날짜별 그룹핑 및 정렬
  const sorted = useMemo(() => {
    console.log('[NOTICE PAGE] Sorting notices, length:', notices.length);
    return [...notices].sort((a, b) => new Date(b.plt_sdate).getTime() - new Date(a.plt_sdate).getTime());
  }, [notices]);

  const grouped = useMemo(() => {
    console.log('[NOTICE PAGE] Grouping notices, length:', sorted.length);
    return groupByDate(sorted);
  }, [sorted]);

  // grouped 데이터가 준비된 후 날짜 확인 및 설정
  useEffect(() => {
    if (Object.keys(grouped).length > 0) {
      const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      // 현재 sticky date가 설정되지 않았거나 잘못되어 있다면 수정
      if (sortedDates.length > 0 && (!currentStickyDate || currentStickyDate !== sortedDates[0])) {
        console.log('[STICKY DATE] 최종 날짜 설정:', sortedDates[0]);
        setCurrentStickyDate(sortedDates[0]);
        setShowStickyDate(true);
      }
    }
  }, [grouped]); // currentStickyDate 의존성 제거하여 무한 루프 방지

  // 스크롤 이벤트 리스너 등록 (초기 날짜 설정 후에만)
  useEffect(() => {
    if (notices.length === 0 || !currentStickyDate) return; // currentStickyDate가 설정된 후에만 실행

    let scrollTimeout: NodeJS.Timeout;
    let lastScrollTime = 0;

    const smartHandleScroll = () => {
      const now = Date.now();
      
      // 빠른 스크롤 감지 (100ms 이내 연속 스크롤)
      if (now - lastScrollTime < 100) {
        // 즉시 실행 (빠른 반응)
        handleScroll();
      } else {
        // 일반 스크롤은 디바운싱
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(handleScroll, 20);
      }
      
      lastScrollTime = now;
    };

    window.addEventListener('scroll', smartHandleScroll, { passive: true });
    
    // 초기 실행을 빠르게 하여 즉시 반응
    const initialTimer = setTimeout(handleScroll, 200);

    return () => {
      window.removeEventListener('scroll', smartHandleScroll);
      clearTimeout(scrollTimeout);
      clearTimeout(initialTimer);
    };
  }, [handleScroll, notices, currentStickyDate]);

  // 섹션 ref 설정 함수
  const setSectionRef = useCallback((date: string) => (el: HTMLElement | null) => {
    if (el) {
      sectionRefs.current.set(date, el);
    } else {
      sectionRefs.current.delete(date);
    }
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // 페이지 진입 애니메이션
  useEffect(() => {
    // 컴포넌트 마운트 후 진입 애니메이션 시작
    const timer = setTimeout(() => {
      setIsEntering(false);
    }, 500); // 애니메이션 시간과 일치

    return () => clearTimeout(timer);
  }, []);

  // 알림 목록 조회 - 리렌더링 방지를 위해 ref 사용
  useEffect(() => {
    // const dataFetchedRef = React.useRef(false); // 기존 위치에서 제거
    
    // 이미 데이터를 가져왔으면 다시 가져오지 않음
    if (dataFetchedRef.current) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!user?.mt_idx) {
          console.error('[NOTICE PAGE] 사용자 정보가 없습니다.');
          setNotices([]);
          setLoading(false);
          return;
        }
        const data = await notificationService.getMemberPushLogs(user.mt_idx.toString());
        
        console.log('[NOTICE PAGE] Fetched data length:', Array.isArray(data) ? data.length : 'Data is not an array');
        if (isMounted) {
          if (Array.isArray(data)) {
        setNotices(data);
          } else {
            console.error('[NOTICE PAGE] Fetched data is not an array. Setting notices to empty array.', data);
            setNotices([]); // 데이터가 배열이 아니면 빈 배열로 설정
          }
          dataFetchedRef.current = true;
        }
      } catch (error) {
        console.error('Error fetching notices:', error);
        if (isMounted) {
          setNotices([]); // 에러 발생 시에도 빈 배열로 설정
        }
      } finally {
        if (isMounted) { // finally 블록에서도 isMounted 체크
        setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  console.log('[NOTICE PAGE] Render - loading:', loading, 'notices length:', notices.length, 'grouped keys:', Object.keys(grouped));

  // 전체 삭제 핸들러
  const handleDeleteAll = async () => {
    setIsDeleteModalOpen(true);
  };

  // 실제 삭제 실행
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (!user?.mt_idx) {
        console.error('[NOTICE PAGE] 사용자 정보가 없습니다.');
        return;
      }
      const response = await notificationService.deleteAllNotifications(user.mt_idx);
      console.log(response.message);
      setNotices([]);
      setIsDeleteModalOpen(false);
      toast({
        title: '성공',
        description: '모든 알림이 삭제되었습니다.',
      });
    } catch (error) {
      console.error('Error deleting notices:', error);
      toast({
        title: '오류',
        description: '알림 삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // 뒤로가기 애니메이션 핸들러
  const handleBackNavigation = () => {
    setIsExiting(true);
    // 애니메이션 완료 후 페이지 이동
    setTimeout(() => {
      router.back();
    }, 400); // 애니메이션 시간과 일치
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 ${
        isExiting ? 'animate-slideOutToRight' : 
        isEntering ? 'animate-slideInFromRight' : ''
      }`}>
        <style jsx global>{mobileAnimations}</style>
        
        {/* 개선된 헤더 - group/page.tsx 스타일 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-0 left-0 right-0 z-20 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBackNavigation}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
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
                  className="p-2 bg-indigo-600 rounded-xl"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">알림</h1>
                  <p className="text-xs text-gray-500">새로운 소식을 확인해보세요</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </motion.header>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 ${
      isExiting ? 'animate-slideOutToRight' : 
      isEntering ? 'animate-slideInFromRight' : ''
    }`}>
      <style jsx global>{mobileAnimations}</style>
      
      {/* 개선된 헤더 - group/page.tsx 스타일 */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed top-0 left-0 right-0 z-20 glass-effect"
      >
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center space-x-3">
            <motion.button 
              onClick={handleBackNavigation}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
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
                className="p-2 bg-indigo-600 rounded-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </motion.div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">알림</h1>
                <p className="text-xs text-gray-500">새로운 소식을 확인해보세요</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <motion.button
              onClick={handleDeleteAll}
              disabled={notices.length === 0}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              전체삭제
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* 메인 컨텐츠 영역 - 패딩 조정 */}
      <main className="pt-20 pb-8 bg-gradient-to-b from-indigo-50/30 to-white">
        <div className="px-4 pt-6 pb-16">
          {notices.length === 0 ? (
            <div className="fixed inset-0 bg-indigo-50 flex items-center justify-center z-[5]">
              <div className="text-center px-6 py-12">
                <div className="mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-5 5-5-5h5v-6h5v6zM9 7H4l5-5 5 5H9v6H4V7z" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-3">알림이 없습니다</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                  새로운 알림이 도착하면<br />
                  여기에 표시됩니다
                </p>
              </div>
            </div>
           ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([date, items]) => (
                 <section 
                   key={date}  
                   data-date={date}
                   ref={setSectionRef(date)}
                   className="relative"
                 >
                   {/* 날짜 헤더 - 모바일 최적화 */}
                   <div className="sticky top-20 z-[8] mb-3">
                     <div className="bg-gray-900 backdrop-blur-md rounded-lg px-4 py-2 mx-2 shadow-sm border border-gray-800 text-white">
                       <div className="flex items-center justify-center space-x-2">
                         <div className="w-1.5 h-1.5 bg-pink-400 rounded-full"></div>
                         <span className="text-sm font-semibold text-white">
                           {format(new Date(date), 'MM월 dd일 (E)', { locale: ko })}
                         </span>
                         <div className="w-1.5 h-1.5 bg-pink-400 rounded-full"></div>
                       </div>
                     </div>
                   </div>

                   {/* 알림 카드들 */}
                   <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 mx-2 overflow-hidden">
                     {items.map((item, index) => (
                       <div 
                         key={item.plt_idx} 
                         className={`flex items-start p-4 transition-colors ${
                           index !== items.length - 1 ? 'border-b border-gray-200' : ''
                         } hover:bg-gray-50/50 active:bg-gray-100/50`}
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
                             <time className="text-xs text-indigo-400 font-medium flex-shrink-0">
                               {format(new Date(item.plt_sdate), 'a h:mm', { locale: ko })}
                             </time>
                           </div>
                           <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">
                             {item.plt_content}
                           </p>
                         </div>
                       </div>
                     ))}
                   </div>
                 </section>
               ))}
             </div>
           )}
         </div>
      </main>

      {/* 전체 삭제 확인 모달 */}
      {isDeleteModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-md mx-auto animate-slideInFromBottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">전체 삭제</h3>
                <p className="text-gray-600 mb-4">
                  정말 <span className="font-medium text-red-600">모든 알림</span>을 삭제하시겠습니까?
                </p>
                <p className="text-sm text-gray-500">
                  삭제된 알림은 복구할 수 없습니다.
                </p>
              </div>
              
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      삭제 중...
                    </>
                  ) : (
                    '모든 알림 삭제'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="w-full py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// React.memo를 사용하여 불필요한 리렌더링 방지
const MemoizedNoticeContent = React.memo(NoticeContent);

export default function NoticePage() {
  return <MemoizedNoticeContent />;
} 
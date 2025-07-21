'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FiChevronLeft, 
  FiCalendar, 
  FiEye 
} from 'react-icons/fi';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';

// 공지사항 상세 타입 정의
interface NoticeDetail {
  nt_idx: number;
  nt_title: string;
  nt_content: string;
  nt_file1?: string;
  nt_hit: number;
  nt_wdate: string;
  nt_uwdate: string;
}

// API 호출 함수
const fetchNoticeDetail = async (id: number): Promise<NoticeDetail> => {
  try {
    const response = await fetch(`/api/v1/notices/${id}?increment_hit=true`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('공지사항 상세 API 호출 실패:', error);
    throw error;
  }
};

// 날짜 포맷팅 함수
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
};

export default function NoticeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // 스크롤 위치 감지
  const handleScroll = () => {
    if (!mainRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
    
    // 상단에 있는지 확인
    setIsAtTop(scrollTop <= 0);
    
    // 하단에 있는지 확인 (1px 여유)
    const isBottom = scrollTop + clientHeight >= scrollHeight - 1;
    setIsAtBottom(isBottom);
  };

  // 터치 이벤트 방지
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!mainRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
    const touch = e.touches[0];
    const startY = touch.clientY;
    
    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // 상단에서 위로 스크롤하려고 할 때
      if (scrollTop <= 0 && deltaY > 0) {
        e.preventDefault();
        return;
      }
      
      // 하단에서 아래로 스크롤하려고 할 때
      if (scrollTop + clientHeight >= scrollHeight - 1 && deltaY < 0) {
        e.preventDefault();
        return;
      }
    };
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const noticeId = params?.id ? parseInt(params.id as string) : null;

  // 페이지 로드 시 body에 data-page 속성 추가 및 position fixed 해제
  useEffect(() => {
    document.body.setAttribute('data-page', '/setting/notice/[id]');
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

  // 공지사항 상세 데이터 로딩
  useEffect(() => {
    if (!noticeId) {
      setError('잘못된 공지사항 ID입니다.');
      setIsLoading(false);
      return;
    }

    const loadNoticeDetail = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await fetchNoticeDetail(noticeId);
        setNotice(data);
      } catch (error) {
        console.error('공지사항 상세 로딩 실패:', error);
        setError('공지사항을 불러오는데 실패했습니다.');
        setNotice(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadNoticeDetail();
  }, [noticeId]);

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <style jsx global>{`
        .glass-effect {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 9999 !important;
          background: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
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

        body, html {
          word-break: keep-all;
        }
      `}</style>
      
      <div 
        className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 notice-page-active" 
        id="setting-notice-detail-page-container"
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
        {/* 헤더 */}
        <motion.header 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed notice-header"
          style={{ 
            paddingTop: '0px',
            marginTop: '0px',
            top: '0px',
            position: 'fixed',
            zIndex: 2147483647,
            left: '0px',
            right: '0px',
            width: '100vw',
            height: '64px',
            minHeight: '64px',
            maxHeight: '64px',
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
          <div className="flex items-center justify-between h-14 px-4">
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              className="flex items-center space-x-2"
              style={{ 
                transform: 'translateX(0) !important',
                animation: 'none !important'
              }}
            >
              <motion.button 
                onClick={handleBack}
                initial={{ opacity: 0, x: -40, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ 
                  transform: 'scale(1) !important',
                  animation: 'none !important'
                }}
              >
                <FiChevronLeft className="w-5 h-5 text-gray-700" />
              </motion.button>
              <div style={{ 
                transform: 'translateX(0) !important',
                animation: 'none !important'
              }}>
                <h1 className="text-lg font-bold text-gray-900">공지사항</h1>
                <p className="text-xs text-gray-500">상세 내용</p>
              </div>
            </motion.div>
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </motion.header>
        
        {/* 메인 컨텐츠 - 헤더 고정에 맞춘 구조 */}
        <main 
          className="pt-20 px-4 pb-6 overflow-y-auto" 
          ref={mainRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          style={{ 
            height: 'calc(100vh - 80px)',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* 로딩 상태 */}
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="flex items-center space-x-4 mb-4">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </motion.div>
        )}

          {/* 에러 상태 */}
          {error && !isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
            <div className="bg-red-50 rounded-2xl p-4">
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
            </div>
          </motion.div>
        )}

          {/* 공지사항 상세 내용 */}
          {notice && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              {/* 제목 */}
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-xl font-bold text-gray-900 mb-4 leading-tight"
                style={{ wordBreak: 'keep-all' }}
              >
                {notice.nt_title}
              </motion.h1>

              {/* 메타 정보 */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex items-center space-x-4 text-sm text-gray-500 mb-6 pb-4 border-b border-gray-100"
              >
                <div className="flex items-center space-x-1">
                  <FiCalendar className="w-4 h-4" />
                  <span>{formatDate(notice.nt_wdate)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FiEye className="w-4 h-4" />
                  <span>조회 {notice.nt_hit}회</span>
                </div>
              </motion.div>

              {/* 첨부파일 */}
              {notice.nt_file1 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mb-6"
                >
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-sm text-gray-700">첨부파일: {notice.nt_file1}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 내용 */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="prose prose-sm max-w-none"
              >
                <div 
                  className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {notice.nt_content}
                </div>
              </motion.div>

              {/* 수정일시 (등록일시와 다른 경우만 표시) */}
              {notice.nt_uwdate !== notice.nt_wdate && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="mt-6 pt-4 border-t border-gray-100"
                >
                  <p className="text-xs text-gray-400">
                    최종 수정: {formatDate(notice.nt_uwdate)}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
        </main>
      </div>
    </>
  );
} 
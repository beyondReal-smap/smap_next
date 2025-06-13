'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiBell, FiCalendar, FiEye } from 'react-icons/fi';

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

  const noticeId = params?.id ? parseInt(params.id as string) : null;

  // 페이지 마운트 시 스크롤 설정
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
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
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
          overflow: visible !important;
        }

        body, html {
          word-break: keep-all;
        }
      `}</style>
      
      <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen">
        {/* 헤더 */}
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
          className="fixed top-0 left-0 right-0 z-50 glass-effect"
          style={{ position: 'fixed', zIndex: 9999 }}
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
                  <p className="text-xs text-gray-500">상세 내용</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.header>

        {/* 로딩 상태 */}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 pt-20 pb-6"
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
            className="px-4 pt-20 pb-6"
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
            className="px-4 pt-20 pb-6"
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
      </div>
    </>
  );
} 
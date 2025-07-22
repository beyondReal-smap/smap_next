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

  const noticeId = params?.id ? parseInt(params.id as string) : null;

  // 페이지 스크롤 관리
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
    <div className="fixed inset-0 bg-gray-50 overflow-hidden">
      {/* 헤더 - setting/notice 페이지와 스타일 및 애니메이션 동기화 */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-20"
        style={{
          height: '56px',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
          paddingTop: '0px !important', // 헤더 상단 패딩 강제 제거
        }}
      >
        <div className="flex items-center justify-between h-full px-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }} // duration을 0.3으로 변경
            className="flex items-center space-x-3"
          >
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">공지사항</h1>
              <p className="text-xs text-gray-500">상세 내용</p>
            </div>
          </motion.div>
        </div>
      </motion.header>
      
      {/* 메인 컨텐츠 */}
      <main 
        className="absolute inset-0 pt-14 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="p-4">
          {/* 로딩 상태 */}
          {isLoading && (
            <div className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4 w-3/4"></div>
              <div className="flex items-center space-x-4 mb-4">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          )}

          {/* 에러 상태 */}
          {error && !isLoading && (
            <div className="bg-red-50 text-red-700 rounded-2xl p-4">
              <h3 className="font-bold mb-2">오류 발생</h3>
              <p>{error}</p>
            </div>
          )}

          {/* 공지사항 상세 내용 */}
          {notice && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-white rounded-2xl shadow-sm p-5" // 컨테이너 복구
            >
              <h1 className="text-xl font-bold text-gray-900 mb-4 leading-tight" style={{ wordBreak: 'keep-all' }}>
                {notice.nt_title}
              </h1>

              <div className="flex items-center space-x-4 text-sm text-gray-500 mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center space-x-1">
                  <FiCalendar className="w-4 h-4" />
                  <span>{formatDate(notice.nt_wdate)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FiEye className="w-4 h-4" />
                  <span>조회 {notice.nt_hit}회</span>
                </div>
              </div>

              <div 
                className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap"
                style={{ wordBreak: 'keep-all' }}
                dangerouslySetInnerHTML={{ __html: notice.nt_content.replace(/\n/g, '<br />') }}
              />

              {notice.nt_uwdate !== notice.nt_wdate && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    최종 수정: {formatDate(notice.nt_uwdate)}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
} 
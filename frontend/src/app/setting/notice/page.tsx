'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FiBell, 
  FiCalendar, 
  FiChevronLeft
} from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
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
  const response = await fetch(`/api/v1/notices?page=${page}&size=${size}&show_only=true`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
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

// 내용 요약 함수
const truncateContent = (content: string, maxLength: number = 100): string => {
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
};


export default function NoticePage() {
  const router = useRouter();
  const { state } = useAuth();
  const { user } = state;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // 페이지 마운트 시 스크롤 설정 (manual 페이지와 동일)
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
        setError('공지사항을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    loadNotices();
  }, []);

  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.SELECTION);
    router.push('/setting');
  };

  return (
    <div 
      className="fixed inset-0 overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50"
    >
      <AnimatedHeader 
        variant="enhanced"
        className="setting-header"
      >
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="setting-header-content motion-div"
        >
          <motion.button
            onClick={handleBack}
            className="setting-back-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiChevronLeft className="w-5 h-5 text-gray-700" />
          </motion.button>
          <div className="setting-header-text">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">공지사항</h1>
            <p className="text-xs text-gray-500 leading-tight">최신 소식을 확인하세요</p>
          </div>
        </motion.div>
      </AnimatedHeader>
        
      <main 
        className="absolute inset-0 px-4 pb-6 space-y-6 overflow-y-auto"
        style={{ paddingTop: '72px' }}
      >
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-6"
          >
            <div className="bg-[#EF4444] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <FiBell className="w-8 h-8" />
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

                </div>
              </div>
            </div>
          </motion.div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice, idx) => (
                <motion.div
                  key={notice.nt_idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx, duration: 0.5 }}
                >
                  <Link 
                    href={`/setting/notice/${notice.nt_idx}`} 
                    className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-transform transform hover:-translate-y-1"
                  >
                    <h3 className="font-bold text-base text-gray-900 mb-2">{notice.nt_title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{truncateContent(notice.nt_content)}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{formatDate(notice.nt_wdate)}</span>
                      <span>조회 {notice.nt_hit}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
      </main>
    </div>
  );
} 
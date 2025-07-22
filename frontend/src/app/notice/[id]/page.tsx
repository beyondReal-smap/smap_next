'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiArrowLeft, FiClock, FiBell } from 'react-icons/fi';
import { PushLog } from '@/types/push';
import notificationService from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import AnimatedHeader from '../../../components/common/AnimatedHeader';

export default function NoticeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [notice, setNotice] = useState<PushLog | null>(null);
  const [loading, setLoading] = useState(true);

  const noticeId = params.id as string;

  useEffect(() => {
    const fetchNoticeDetail = async () => {
      try {
        setLoading(true);
        if (!user?.mt_idx || !noticeId) {
          console.error('[NOTICE DETAIL] 사용자 정보 또는 알림 ID가 없습니다.');
          setLoading(false);
          return;
        }

        // 현재는 전체 알림 목록에서 해당 ID의 알림을 찾는 방식으로 구현
        const allNotices = await notificationService.getMemberPushLogs(user.mt_idx.toString());
        const targetNotice = Array.isArray(allNotices) 
          ? allNotices.find(n => n.plt_idx.toString() === noticeId)
          : null;

        if (targetNotice) {
          setNotice(targetNotice);
        } else {
          console.error('[NOTICE DETAIL] 해당 알림을 찾을 수 없습니다:', noticeId);
        }
      } catch (error) {
        console.error('[NOTICE DETAIL] 알림 상세 정보 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNoticeDetail();
  }, [user, noticeId]);

  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.LIGHT);
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <AnimatedHeader 
          variant="enhanced"
          className="fixed top-0 left-0 right-0 z-20 glass-effect header-fixed"
        >
          <div className="flex items-center justify-between h-14 px-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              className="flex items-center space-x-3 motion-div"
            >
              <button 
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">알림 상세</h1>
                <p className="text-xs text-gray-500">로딩 중...</p>
              </div>
            </motion.div>
          </div>
        </AnimatedHeader>

        <div className="px-4 pt-20 space-y-6 pb-24">
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
              <FiBell className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-gray-500">알림을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <AnimatedHeader 
          variant="enhanced"
          className="fixed top-0 left-0 right-0 z-20 glass-effect header-fixed"
        >
          <div className="flex items-center justify-between h-14 px-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              className="flex items-center space-x-3 motion-div"
            >
              <button 
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">알림 상세</h1>
                <p className="text-xs text-gray-500">알림을 찾을 수 없습니다</p>
              </div>
            </motion.div>
          </div>
        </AnimatedHeader>

        <div className="px-4 pt-20 space-y-6 pb-24">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiBell className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">알림을 찾을 수 없습니다</h3>
            <p className="text-gray-500">요청하신 알림이 존재하지 않거나 삭제되었습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <AnimatedHeader 
        variant="enhanced"
        className="fixed top-0 left-0 right-0 z-20 glass-effect header-fixed"
      >
        <div className="flex items-center justify-between h-14 px-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            className="flex items-center space-x-3 motion-div"
          >
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
            >
              <FiArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">알림 상세</h1>
              <p className="text-xs text-gray-500">알림 내용을 확인하세요</p>
            </div>
          </motion.div>
        </div>
      </AnimatedHeader>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="px-4 pt-20 space-y-6 pb-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6"
        >
          {/* 알림 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xl">
                  {notice.plt_title.match(/\p{Extended_Pictographic}/u)?.[0] || '📢'}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {notice.plt_title.replace(/\p{Extended_Pictographic}/u, '').trim()}
                </h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <FiClock className="w-4 h-4" />
                  <time>
                    {format(new Date(notice.plt_sdate), 'yyyy년 MM월 dd일 a h:mm', { locale: ko })}
                  </time>
                </div>
              </div>
            </div>
          </div>

          {/* 알림 내용 */}
          <div className="border-t border-gray-100 pt-4">
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {notice.plt_content}
              </p>
            </div>
          </div>

          {/* 읽음 상태 */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${notice.plt_read_chk === 'Y' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {notice.plt_read_chk === 'Y' ? '읽음' : '읽지 않음'}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                ID: {notice.plt_idx}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
} 
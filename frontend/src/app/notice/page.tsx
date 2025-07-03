'use client';

import { useState, useEffect, useRef } from 'react';
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
  position: relative;
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
  const dataFetchedRef = useRef(false);

  // 공지사항 데이터 로드
  useEffect(() => {
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
        
        // 읽지 않은 알림이 있으면 모두 읽음 처리
        if (Array.isArray(data) && data.length > 0) {
          const unreadNotifications = data.filter(notification => notification.plt_read_chk === 'N');
          if (unreadNotifications.length > 0) {
            try {
              await notificationService.markAllAsRead(user.mt_idx);
              console.log('[NOTICE PAGE] 읽지 않은 알림', unreadNotifications.length, '개 읽음 처리 완료');
              
              // 읽음 처리 후 데이터 다시 가져오기
              const updatedData = await notificationService.getMemberPushLogs(user.mt_idx.toString());
              if (isMounted) {
                setNotices(Array.isArray(updatedData) ? updatedData : []);
                dataFetchedRef.current = true;
              }
            } catch (error) {
              console.error('[NOTICE PAGE] 읽음 처리 실패:', error);
              // 읽음 처리 실패해도 기존 데이터는 표시
              if (isMounted) {
                setNotices(data);
                dataFetchedRef.current = true;
              }
            }
          } else {
            // 읽지 않은 알림이 없으면 그대로 설정
            if (isMounted) {
              setNotices(data);
              dataFetchedRef.current = true;
            }
          }
        } else {
          if (isMounted) {
            console.error('[NOTICE PAGE] Fetched data is not an array. Setting notices to empty array.', data);
            setNotices([]); // 데이터가 배열이 아니면 빈 배열로 설정
            dataFetchedRef.current = true;
          }
        }
      } catch (error) {
        console.error('Error fetching notices:', error);
        if (isMounted) {
          setNotices([]); // 에러 발생 시에도 빈 배열로 설정
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          // 데이터 로딩 완료 햅틱 피드백
          triggerHapticFeedback(HapticFeedbackType.SUCCESS, '알림 데이터 로딩 완료', { 
            component: 'notice', 
            action: 'data-load-complete' 
          });
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.LIGHT);
    router.back();
  };

  const handleNoticeClick = (notice: PushLog) => {
    triggerHapticFeedback(HapticFeedbackType.LIGHT);
    // 공지사항 상세 페이지로 이동 (PushLog의 plt_idx 사용)
    router.push(`/notice/${notice.plt_idx}`);
  };

  // 날짜별 그룹핑 및 정렬
  const sorted = [...notices].sort((a, b) => new Date(b.plt_sdate).getTime() - new Date(a.plt_sdate).getTime());
  const grouped = groupByDate(sorted);

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className="schedule-page-container bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* 고정 헤더 */}
        <AnimatedHeader 
          variant="enhanced"
          className="fixed top-0 left-0 right-0 z-20 glass-effect header-fixed"
        >
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center justify-between h-14 px-4"
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
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="flex items-center space-x-3"
              >
                <div>
                  <h1 className="text-lg font-bold text-gray-900">알림</h1>
                  <p className="text-xs text-gray-500">최신 소식을 확인하세요</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatedHeader>

        {/* 스크롤 가능한 메인 컨텐츠 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="schedule-page-content px-4 pt-20 space-y-6 pb-24"
        >
          {loading ? (
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
          ) : (
            /* 알림 목록 - 날짜별 그룹핑 */
            <div className="space-y-6">
              {Object.entries(grouped).map(([date, items]) => (
                <section key={date} className="relative">
                  {/* 날짜 헤더 */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="sticky top-1 z-[8] mb-5"
                  >
                    <div className="bg-gray-900 backdrop-blur-md rounded-lg px-4 py-2 mx-2 shadow-sm border border-gray-800 text-white">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                        <span className="text-sm font-semibold text-white">
                          {format(new Date(date), 'MM월 dd일 (E)', { locale: ko })}
                        </span>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      </div>
                    </div>
                  </motion.div>

                  {/* 알림 카드들 */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
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
'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PushLog, DeleteAllResponse } from '@/types/push';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';
import notificationService from '@/services/notificationService';

// 모바일 최적화된 CSS 애니메이션
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

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
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
  const [notices, setNotices] = useState<PushLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dataFetchedRef = React.useRef(false);

  // 알림 목록 조회 - 리렌더링 방지를 위해 ref 사용
  useEffect(() => {
    // const dataFetchedRef = React.useRef(false); // 기존 위치에서 제거
    
    // 이미 데이터를 가져왔으면 다시 가져오지 않음
    if (dataFetchedRef.current) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await notificationService.getMemberPushLogs('1186');
        
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
  }, []);

  // 날짜별 그룹핑 및 정렬
  const sorted = useMemo(() => {
    console.log('[NOTICE PAGE] Sorting notices, length:', notices.length);
    return [...notices].sort((a, b) => new Date(b.plt_sdate).getTime() - new Date(a.plt_sdate).getTime());
  }, [notices]);

  const grouped = useMemo(() => {
    console.log('[NOTICE PAGE] Grouping notices, length:', sorted.length);
    return groupByDate(sorted);
  }, [sorted]);

  console.log('[NOTICE PAGE] Render - loading:', loading, 'notices length:', notices.length, 'grouped keys:', Object.keys(grouped));

  // 전체 삭제 핸들러
  const handleDeleteAll = async () => {
    setIsDeleteModalOpen(true);
  };

  // 실제 삭제 실행
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await notificationService.deleteAllNotifications(1186);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50">
        <div className="text-center px-6">
          <LoadingSpinner 
            message="알림을 불러오는 중입니다..." 
            fullScreen={true}
            type="ripple"
            size="md"
            color="blue"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50">
      <style jsx global>{mobileAnimations}</style>
      {/* 앱 헤더 - 그룹 페이지 스타일 (고정) */}
      <div className="sticky top-0 z-10 px-4 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center">
            <button 
              onClick={() => router.back()}
              className="px-2 py-2 hover:bg-indigo-200 transition-all duration-200 mr-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="ml-1 text-lg font-normal text-gray-900">알림</span>
          </div>
          <button
            onClick={handleDeleteAll}
            className="flex items-center text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded transition-colors"
            aria-label="전체 삭제"
            disabled={notices.length === 0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            전체삭제
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <main className="pb-8">
        <div className="px-4 pt-4">
          {notices.length > 0 && (
            <div className="px-2">
              <p className="text-indigo-600 text-sm">푸시 알림 내역을 확인하세요.</p>
            </div>
          )}
          {notices.length === 0 ? (
            <div className="bg-white rounded-xl shadow px-4 py-16">
              <div className="text-center text-gray-400">
                <div className="mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-5 5-5-5h5v-6h5v6zM9 7H4l5-5 5 5H9v6H4V7z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-500">알림이 없습니다</p>
                <p className="text-sm text-gray-400 mt-2">새로운 알림이 도착하면 여기에 표시됩니다</p>
              </div>
            </div>
           ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([date, items]) => (
                 <section key={date} className="mb-4">
                   <div className="text-base font-bold text-gray-600 mb-2 px-2">
                     {format(new Date(date), 'yyyy.MM.dd (E)', { locale: ko })}
                     {date === format(new Date(), 'yyyy-MM-dd') && (
                       <span className="text-primary ml-2">오늘의 알림</span>
                     )}
                   </div>
                   <div className="bg-white rounded-xl shadow px-4 py-4">
                     <div className="">
                       {items.map((item, index) => (
                         <div 
                           key={item.plt_idx} 
                           className={`flex items-start border-b last:border-b-0 border-gray-100 py-3 px-3 transition-colors ${
                             index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                           }`}
                         >
                           <div className="text-2xl ml-2 mr-3 mt-1 select-none">
                             {item.plt_title.match(/\p{Extended_Pictographic}/u)?.[0] || '📢'}
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2">
                               <span className="font-bold text-gray-900 text-sm leading-tight">
                                 {item.plt_title.replace(/\p{Extended_Pictographic}/u, '').trim()}
                               </span>
                             </div>
                             <div className="text-gray-700 text-sm whitespace-pre-line mt-0.5 leading-snug">
                               {item.plt_content}
                             </div>
                             <div className="text-xs text-gray-400 mt-1">
                               {format(new Date(item.plt_sdate), 'a h:mm', { locale: ko })}
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
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
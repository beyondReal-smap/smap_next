'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PushLog, DeleteAllResponse } from '@/types/push';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { FcGoogle } from 'react-icons/fc';
import { SiKakaotalk } from 'react-icons/si';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 알림 목록 조회
  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/push-logs/member/1186');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch notices. Status: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[NOTICE PAGE] Fetched data length:', data.length);
        setNotices(data);
      } catch (error) {
        console.error('Error fetching notices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotices();
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
    if (window.confirm('정말 모든 알림을 삭제하시겠습니까?')) {
      try {
        const response = await fetch('/api/push-logs/delete-all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mt_idx: 1186 }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete notices');
        }

        const data: DeleteAllResponse = await response.json();
        console.log(data.message);
        setNotices([]);
      } catch (error) {
        console.error('Error deleting notices:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch('/api/notice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('공지사항 등록에 실패했습니다.');
      }

      toast({
        title: '성공',
        description: '공지사항이 등록되었습니다.',
      });

      router.push('/notice/list');
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <LoadingSpinner message="알림을 불러오는 중입니다..." />
      </div>
    );
  }

  return (
    <div>
      {/* 상단 고정 헤더 + 전체 삭제 버튼 */}
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-12 justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                aria-label="뒤로 가기"
                className="p-2 mr-2 -ml-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <h1 className="text-lg font-medium text-gray-900 truncate">앱 푸시 알림</h1>
            </div>
            <button
              onClick={handleDeleteAll}
              className="flex items-center text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
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
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="pt-12 pb-8">
        <div className="px-4 pb-2">
          <p className="text-gray-600 text-sm">푸시 알림 내역을 확인하세요.</p>
        </div>
        <div className="px-2">
          {notices.length === 0 ? (
             <div className="text-center text-gray-400 py-16">알림이 없습니다.</div>
           ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([date, items]) => (
                 <section key={date} className="mb-8">
                   <div className="text-base font-bold text-indigo-600 mb-2 px-2">
                     {format(new Date(date), 'yyyy.MM.dd (E)', { locale: ko })}
                     {date === format(new Date(), 'yyyy-MM-dd') && (
                       <span className="text-primary ml-2">오늘의 알림</span>
                     )}
                   </div>
                   <div className="bg-white rounded-xl shadow px-3 py-4">
                     <div className="space-y-3">
                       {items.map(item => (
                         <div key={item.plt_idx} className="flex items-start border-b last:border-b-0 border-gray-100 pb-3 last:pb-0">
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

      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>공지사항 작성</CardTitle>
            <CardDescription>새로운 공지사항을 작성합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">내용</Label>
                <Textarea id="content" name="content" required className="min-h-[200px]" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '등록 중...' : '등록'}
                </Button>
              </div>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    또는
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // 구글 로그인 처리
                    console.log('Google login clicked');
                  }}
                >
                  <FcGoogle className="mr-2 h-5 w-5" />
                  구글로 가입
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // 카카오 로그인 처리
                    console.log('Kakao login clicked');
                  }}
                >
                  <SiKakaotalk className="mr-2 h-5 w-5 text-yellow-400" />
                  카카오로 가입
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NoticePage() {
  return <NoticeContent />;
} 
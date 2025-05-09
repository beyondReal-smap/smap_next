'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 알림 데이터 타입 정의
interface PushItem {
  id: string;
  type: string;
  icon: string;
  title: string;
  content: string;
  date: string; // ISO string
}

// 예시용 알림 데이터 (실제 데이터 구조에 맞게 수정)
const MOCK_PUSHES: PushItem[] = [
  {
    id: '1',
    type: 'alarm',
    icon: '⏰',
    title: '일정 시작알림',
    content: "'집' 일정 30분 전 입니다.",
    date: '2025-05-08T18:30:00',
  },
  {
    id: '2',
    type: 'report',
    icon: '🧑‍🤝‍🧑',
    title: '오늘의 그룹원 동향 리포트',
    content: '그룹원들의 하루 동선이 궁금하신가요?\n로그에서 모든 것을 확인하세요!',
    date: '2025-05-08T18:00:00',
  },
  {
    id: '3',
    type: 'alarm',
    icon: '⏰',
    title: '일정 시작알림',
    content: "'미래탑구' 일정 30분 전 입니다.",
    date: '2025-05-08T14:30:00',
  },
  {
    id: '4',
    type: 'info',
    icon: '👀',
    title: '그룹원 동향을 한눈에!',
    content: "'내 장소'를 설정하고 스마트하게 관리하세요.\n100m 반경 내 그룹원 출입 시 알림을 받을 수 있어요. 🔔",
    date: '2025-05-08T14:00:00',
  },
  {
    id: '5',
    type: 'weather',
    icon: '☁️',
    title: '날씨 정보',
    content: '서울특별시 영등포구/여의동\n강수확률 : 0%\n최저기온 : 9.0°C\n최고기온 : 23.0°C',
    date: '2025-05-08T08:12:00',
  },
  {
    id: '6',
    type: 'alarm',
    icon: '⏰',
    title: '일정 시작알림',
    content: "'학교' 일정 30분 전 입니다.",
    date: '2025-05-08T08:10:00',
  },
  {
    id: '7',
    type: 'alarm',
    icon: '⏰',
    title: '일정 시작알림',
    content: "'집' 일정 30분 전 입니다.",
    date: '2025-05-07T23:35:00',
  },
  {
    id: '8',
    type: 'alarm',
    icon: '⏰',
    title: '일정 시작알림',
    content: "'집' 일정 30분 전 입니다.",
    date: '2025-05-07T18:30:00',
  },
  {
    id: '9',
    type: 'timeline',
    icon: '🕰️',
    title: '그룹원들의 하루 타임라인',
    content: '시간별로 그룹원들의 활동을 정리했어요.\n오늘 하루는 어떻게 흘러갔는지 로그에서 확인하세요!🙊',
    date: '2025-05-07T18:00:00',
  },
  {
    id: '10',
    type: 'info',
    icon: '👀',
    title: '그룹원 동향을 한눈에!',
    content: "'내 장소'를 설정하고 스마트하게 관리하세요.\n100m 반경 내 그룹원 출입 시 알림을 받을 수 있어요. 🔔",
    date: '2025-05-07T14:00:00',
  },
];

// 날짜별 그룹핑 함수
function groupByDate(list: PushItem[]): Record<string, PushItem[]> {
  return list.reduce((acc: Record<string, PushItem[]>, item: PushItem) => {
    const date = item.date.slice(0, 10); // 'YYYY-MM-DD'
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
}

function NoticeContent() {
  const router = useRouter();
  // 알림 상태 관리
  const [notices, setNotices] = useState<PushItem[]>(MOCK_PUSHES);

  // 날짜별 그룹핑 및 정렬
  const sorted: PushItem[] = [...notices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const grouped = groupByDate(sorted);
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  // 전체 삭제 핸들러
  const handleDeleteAll = () => {
    if (window.confirm('정말 모든 알림을 삭제하시겠습니까?')) {
      setNotices([]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
      {/* 안내문구 */}
      <div className="pt-10 px-4 pb-2">
        <p className="text-gray-600 text-sm">푸시 알림 내역을 확인하세요.</p>
      </div>
      {/* 날짜별 그룹 */}
      <div className="px-2 pb-8">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center text-gray-400 py-16">알림이 없습니다.</div>
        ) : (
          Object.keys(grouped).map(date => (
            <section key={date} className="mb-8">
              <div className="text-base font-bold text-indigo-600 mb-2 px-2">
                {format(new Date(date), 'yyyy.MM.dd (E)', { locale: ko })}
              </div>
              <div className="bg-white rounded-xl shadow px-3 py-4">
                <div className="space-y-3">
                  {grouped[date].map(item => (
                    <div key={item.id} className="flex items-start border-b last:border-b-0 border-gray-100 pb-3 last:pb-0">
                      <div className="text-2xl ml-2 mr-3 mt-1 select-none">{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm leading-tight">{item.title}</span>
                        </div>
                        <div className="text-gray-700 text-sm whitespace-normal mt-0.5 leading-snug">{item.content}</div>
                        <div className="text-xs text-gray-400 mt-1">{format(new Date(item.date), 'a h:mm', { locale: ko })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export default function NoticePage() {
  return <NoticeContent />;
} 
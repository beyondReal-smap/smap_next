'use client';
import Header from '@/components/Header';
import Link from 'next/link';
import React, { useState } from 'react';

// 공지사항 mock 데이터
const MOCK_NOTICES = [
  {
    id: 1,
    title: '서비스 점검 안내',
    date: '2024-06-10',
    content: '6월 12일(수) 02:00~04:00 서비스 점검이 예정되어 있습니다. 이용에 참고 부탁드립니다.'
  },
  {
    id: 2,
    title: '신규 기능 업데이트',
    date: '2024-05-28',
    content: '그룹 관리 기능이 추가되었습니다. 자세한 내용은 공지사항을 확인해 주세요.'
  },
  // 공지 없을 때는 빈 배열로 테스트 가능
];

export default function NoticePage() {
  const [notices] = useState(MOCK_NOTICES); // []로 바꾸면 내역 없음 테스트 가능

  return (
    <div className="bg-white min-h-screen pb-24">
      <Header title="공지사항" />
      <div className="px-4 pt-12">
        {notices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <svg className="w-14 h-14 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21.75c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Zm0-4.5v-3m0 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" /></svg>
            <div className="text-lg">등록된 공지사항이 없습니다.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <Link key={notice.id} href={`/setting/notice/${notice.id}`} className="block">
                <div className="bg-gray-50 rounded-2xl shadow p-5 hover:bg-indigo-50 transition">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-base text-gray-900">{notice.title}</div>
                    <div className="text-xs text-gray-400 ml-2">{notice.date}</div>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{notice.content}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
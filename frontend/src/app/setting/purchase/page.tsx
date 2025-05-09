'use client';
import Header from '@/components/Header';
import React, { useState } from 'react';

// 구매내역 mock 데이터 예시
const MOCK_PURCHASES = [
  {
    id: 1,
    type: '연간 구독',
    amount: 42000,
    round: 1,
    date: '2024-06-01',
  },
  {
    id: 2,
    type: '월간 구독',
    amount: 4900,
    round: 3,
    date: '2024-04-01',
  },
  // 데이터가 없으면 빈 배열로 테스트 가능
];

export default function PurchasePage() {
  // 실제로는 API로 받아오겠지만, 여기선 mock 데이터 사용
  const [purchases] = useState(MOCK_PURCHASES); // []로 바꾸면 내역 없음 테스트 가능

  return (
    <div className="bg-white min-h-screen pb-24">
      <Header title="구매 내역" />
      <div className="px-4 pt-12">
        {purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <svg className="w-14 h-14 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21.75c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Zm0-4.5v-3m0 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" /></svg>
            <div className="text-lg">구매 내역이 없습니다.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((item) => (
              <div key={item.id} className="bg-gray-50 rounded-2xl shadow p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold mr-2 ${item.type === '연간 구독' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{item.type}</span>
                    <span className="text-gray-400 text-xs">{item.round}회차</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">₩{item.amount.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">결제일: {item.date}</div>
                </div>
                <div className="flex items-center h-full">
                  <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 0 0-10 0v2M5 9h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9Z" /></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
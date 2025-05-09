'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';

export default function SubscriptionPage() {
  const [selected, setSelected] = useState<'month' | 'year'>('year');

  return (
    <div className="bg-white min-h-screen px-4 pt-8 pb-24">
      <Header title="구독 관리" />
      {/* Plus 뱃지 및 안내 */}
      <div className="flex items-center mb-2">
        <span className="bg-blue-600 text-white text-xs font-semibold rounded-full px-3 py-1 mr-2">Plus</span>
        <span className="text-lg font-semibold">SMAP의 모든 기능을 제한없이<br /> 경험해 보세요.</span>
      </div>
      <ul className="mt-4 mb-8 space-y-1 text-base text-gray-800">
        <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span>내 장소를 마음껏 저장해보세요.</li>
        <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span>2주 동안의 로그도 조회할 수 있어요.</li>
        <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span>광고 걱정 없이 쾌적하게 이용해보세요.</li>
        <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span>하루에 최적경로 10회 조회도 가능해요!</li>
        <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span>그룹원을 10명까지 관리 가능해요!</li>
      </ul>

      {/* 구독 상품 카드 */}
      <div className="space-y-3">
        {/* 월간 */}
        <div className={`flex items-center justify-between rounded-2xl border ${selected === 'month' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} px-5 py-5 transition-all`}
             onClick={() => setSelected('month')}>
          <div>
            <div className="text-base font-medium mb-1">월간</div>
            <div className="text-xl font-bold">₩4,900 <span className="text-base font-normal">/ 월</span></div>
          </div>
          <button className={`px-5 py-2 rounded-full border text-base font-semibold ${selected === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-600'}`}>선택</button>
        </div>
        {/* 연간 */}
        <div className={`relative flex items-center justify-between rounded-2xl border ${selected === 'year' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} px-5 py-5 transition-all`}
             onClick={() => setSelected('year')}>
          {/* 인기 뱃지 */}
          <div className="absolute -top-3 -left-3">
            <span className="bg-yellow-400 text-xs font-bold px-3 py-1 rounded-full shadow">인기!!</span>
          </div>
          <div>
            <div className="text-base font-medium mb-1">연간</div>
            <div className="flex items-end space-x-2">
              <span className="text-gray-400 line-through text-base">₩49,000</span>
              <span className="text-xl font-bold text-black">₩42,000 <span className="text-base font-normal">/ 년</span></span>
            </div>
          </div>
          <button className={`px-5 py-2 rounded-full border text-base font-semibold ${selected === 'year' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-600'}`}>선택</button>
        </div>
      </div>

      {/* 안내문 */}
      <div className="mt-8 text-center text-gray-800 text-base font-semibold">
        1주 무료체험, 그 이후부터 매년 <span className="font-bold">₩42,000</span><br />
        앱 스토어에서 언제든지 취소하세요.
      </div>
      <div className="mt-4 text-xs text-gray-400 leading-relaxed text-center">
        무료 체험판 사용 기간이 끝나면 ₩42,000 / 년 요금이 Apple ID계정에 청구됩니다. 현재 기간이 종료되기까지 최소 24시간 전에 구독이 취소되지 않으면 구독이 갱신됩니다. 귀하의 계정은 현 기간이 종료되기 전, 24시간 이내에 갱신되어 요금이 부과됩니다. 구매 후앱 스토어 계정 설정으로 이동하여 구독을 관리하고 취소할 수 있습니다.
      </div>
    </div>
  );
} 
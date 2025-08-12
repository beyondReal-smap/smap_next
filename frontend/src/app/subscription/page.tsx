"use client";

import React from "react";

export default function SubscriptionInfoPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">구독 안내 (Auto‑Renewable Subscriptions)</h1>
      <p className="text-sm text-gray-500 mb-8">시행일: 2025-08-12</p>

      <section className="space-y-6 text-gray-800 leading-7">
        <div>
          <h2 className="text-lg font-semibold">1) 구독 항목(예시)</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li><b>구독 제목</b>: SMAP 프리미엄</li>
            <li><b>구독 기간</b>: 1개월 (자동 갱신)</li>
            <li><b>가격</b>: App Store 표시 가격에 따름 (국가/통화에 따라 상이)</li>
            <li><b>단위 가격</b>: 월 단위</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold">2) 결제 및 갱신</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>결제는 사용자의 Apple ID 계정으로 청구됩니다.</li>
            <li>현재 기간 종료 24시간 전에 구독을 취소하지 않으면 자동 갱신됩니다.</li>
            <li>갱신 비용은 현재 구독 가격과 동일하게 청구됩니다.</li>
            <li>구독은 기기 설정 &gt; Apple ID &gt; 구독에서 관리/해지할 수 있습니다.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold">3) 복원(Restore)</h2>
          <p>구입 내역 복원은 iOS의 "구매 복원" 기능을 통해 가능합니다.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">4) 약관 및 개인정보</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>
              <a href="/terms" className="text-blue-600 underline">이용약관 (Terms of Use)</a>
            </li>
            <li>
              <a href="/privacy" className="text-blue-600 underline">개인정보 처리방침 (Privacy Policy)</a>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}



"use client";

import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">개인정보 처리방침 (Privacy Policy)</h1>
      <p className="text-sm text-gray-500 mb-8">시행일: 2025-08-12</p>

      <section className="space-y-4 text-gray-800 leading-7">
        <p>
          본 방침은 서비스 제공을 위해 수집·이용하는 개인정보 항목, 이용 목적, 보유 및 파기, 제3자 제공,
          처리 위탁, 이용자의 권리와 행사 방법 등을 안내합니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">1. 수집 항목 및 이용 목적</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>계정: 이름, 이메일, 프로필 이미지 — 계정 식별 및 고객지원</li>
          <li>위치 정보(선택): 지도 표시, 도착/근접 알림 제공(예: 모임 장소 안내)</li>
          <li>카메라/사진(선택): 프로필/그룹 이미지 업로드(예: 그룹 아바타 등록)</li>
          <li>알림 토큰: 일정 알림, 공지 푸시 발송</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">2. 보유 및 파기</h2>
        <p>
          관련 법령 또는 이용 목적 달성 시 지체 없이 파기합니다. 백업 보관은 별도 보호 조치 후 일정 기간 보유될 수 있습니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. 제3자 제공 및 처리 위탁</h2>
        <p>
          법령에 근거하거나 이용자의 동의가 있는 경우에 한해 제공하며, FCM 등 클라우드 서비스에 처리를 위탁할 수 있습니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. 이용자의 권리</h2>
        <p>
          열람, 정정, 삭제, 처리정지, 동의 철회 권리를 언제든지 행사할 수 있으며, 문의는 support@smap.site 로 연락하세요.
        </p>
      </section>
    </main>
  );
}



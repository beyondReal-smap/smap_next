import type { Metadata } from "next";

import LegalDocument from "../LegalDocument";

// 원문: 구 웹(nextstep) 설정 > 약관 화면. 앱 가입 화면과 스토어 설명이 이 주소를 링크한다.
export const metadata: Metadata = {
  title: "마케팅 정보 수집 및 이용 동의",
  description: "도착했어의 마케팅 정보 수집 항목·이용 목적과 동의 철회 방법을 안내합니다.",
  alternates: { canonical: "/legal/marketing" },
};

export default function MarketingPage() {
  return (
    <LegalDocument title="마케팅 정보 수집 및 이용 동의" path="/legal/marketing" effectiveDate="2026-01-08">
      <p className="mb-4">
        비욘드리얼(이하 "회사")는 고객에게 더 나은 서비스와 혜택을 제공하기 위해 마케팅 정보 수집 및 이용에 대한 동의를 요청합니다.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">수집하는 마케팅 정보</h2>
      <p className="mb-4">
        회사는 다음과 같은 마케팅 정보를 수집할 수 있습니다:
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>이름, 연락처(전화번호, 이메일)</li>
        <li>서비스 이용 내역 및 선호도</li>
        <li>마케팅 캠페인 참여 이력</li>
        <li>고객 만족도 조사 결과</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">마케팅 정보 이용 목적</h2>
      <p className="mb-4">
        수집된 마케팅 정보는 다음 목적으로만 이용됩니다:
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>신규 서비스 및 이벤트 안내</li>
        <li>맞춤형 혜택 및 프로모션 제공</li>
        <li>고객 만족도 향상을 위한 서비스 개선</li>
        <li>마케팅 성과 분석 및 통계</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">동의 철회 및 거부</h2>
      <p className="mb-4">
        고객은 언제든지 마케팅 정보 수집 및 이용에 대한 동의를 철회하거나 거부할 수 있습니다.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
        <h4 className="font-semibold mb-2 text-sm">동의 철회 방법</h4>
        <p className="text-xs text-gray-700">설정 {'>'}{' '}개인정보 처리방침에서 동의 철회 가능</p>
      </div>
    </LegalDocument>
  );
}

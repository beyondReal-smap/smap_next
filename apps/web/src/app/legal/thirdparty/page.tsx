import type { Metadata } from "next";

import LegalDocument from "../LegalDocument";

// 원문: 구 웹(nextstep) 설정 > 약관 화면. 앱 가입 화면과 스토어 설명이 이 주소를 링크한다.
export const metadata: Metadata = {
  title: "개인정보 제3자 제공 동의",
  description: "도착했어의 개인정보 제3자 제공 원칙과 고지 사항, 동의 철회 방법을 안내합니다.",
  alternates: { canonical: "/legal/thirdparty" },
};

export default function ThirdPartyPage() {
  return (
    <LegalDocument title="개인정보 제3자 제공 동의" path="/legal/thirdparty" effectiveDate="2026-01-08">
      <p className="mb-4">
        비욘드리얼(이하 "회사")는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">제3자 제공이 필요한 경우</h2>
      <p className="mb-4">
        다음의 경우에만 개인정보를 제3자에게 제공할 수 있습니다:
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>이용자가 개인정보의 수집 및 이용에 대한 동의와 별도로 제3자 제공에 사전 동의한 경우</li>
        <li>법률규정이 있거나 법령상 의무준수를 위해 불가피한 경우</li>
        <li>수사기관이 수사목적을 위해 관계법령이 정한 절차를 거쳐 요구하는 경우</li>
        <li>통계작성 및 학술연구 등의 목적을 위해 필요한 경우</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">제3자 제공 시 고지사항</h2>
      <p className="mb-4">
        개인정보를 제3자에게 제공하는 경우 다음 사항을 미리 고지합니다:
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>개인정보를 제공받는 자의 성명과 연락처</li>
        <li>제공받는 자의 개인정보 이용 목적</li>
        <li>제공하는 개인정보의 항목</li>
        <li>제공받는 자의 개인정보 보유 및 이용 기간</li>
        <li>동의 거부권이 존재한다는 사실 및 동의 거부에 따른 불이익의 내용</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">동의 철회 및 거부</h2>
      <p className="mb-4">
        이용자는 언제든지 제3자 제공에 대한 동의를 철회하거나 거부할 수 있습니다.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
        <h4 className="font-semibold mb-2 text-sm">동의 철회 방법</h4>
        <p className="text-xs text-gray-700">설정 {'>'} 개인정보 처리방침에서 동의 철회 가능</p>
      </div>
    </LegalDocument>
  );
}

"use client";

import React from "react";

export default function TermsOfUsePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">이용약관 (Terms of Use)</h1>
      <p className="text-sm text-gray-500 mb-8">시행일: 2025-08-12</p>

      <section className="space-y-4 text-gray-800 leading-7">
        <p>
          본 약관은 SMAP(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항,
          기타 필요한 사항을 규정합니다. 서비스를 이용함으로써 이용자는 본 약관에 동의하게 됩니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">1. 서비스 이용</h2>
        <p>
          서비스는 일정 공유, 위치 기반 안내, 알림 제공 등 팀/가족 협업 기능을 제공합니다. 서비스 이용에는
          계정이 필요하며, 관련 법령 및 본 약관을 준수해야 합니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. 구독 및 결제</h2>
        <p>
          일부 기능은 자동 갱신형 구독을 통해 제공됩니다. 구독의 제목, 기간, 가격 및 단위 가격(해당 시)은
          앱 내 "구독 안내" 화면에서 확인할 수 있습니다. 구독은 기간 종료 24시간 전에 해지하지 않으면
          자동 갱신되며, 결제는 사용자의 Apple ID 계정으로 청구됩니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. 환불 및 해지</h2>
        <p>
          구독 해지는 iOS 기기의 설정 &gt; Apple ID &gt; 구독에서 관리할 수 있으며, 청구된 금액에 대한 환불은
          Apple의 정책을 따릅니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. 개인정보 보호</h2>
        <p>
          회사는 서비스 제공을 위해 필요한 최소한의 개인정보만을 수집·이용하며, 자세한 내용은
          <a href="/privacy" className="text-blue-600 underline ml-1">개인정보 처리방침</a>을 참고하시기 바랍니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">5. 책임 제한</h2>
        <p>
          서비스는 "있는 그대로" 제공되며, 불가항력, 네트워크 장애 등 회사의 합리적 통제를 벗어난 사유로
          발생한 손해에 대하여 회사는 책임을 지지 않습니다.
        </p>

        <h2 className="text-lg font-semibold mt-6">6. 약관 변경</h2>
        <p>
          회사는 관련 법령을 준수하는 범위에서 본 약관을 변경할 수 있으며, 변경 시 앱 또는 웹사이트에 공지합니다.
          변경 약관 공지 이후 서비스 이용 시 변경 사항에 동의한 것으로 봅니다.
        </p>
      </section>
    </main>
  );
}



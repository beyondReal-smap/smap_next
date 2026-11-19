import type { Metadata } from "next";

import LegalDocument from "../LegalDocument";

// 원문: Notion 공개 문서 schedulemap.notion.site/7e35638d106f433f86fa95f88ba6efb1
// (2026-11-19 이전. 앱 이름 'smap' → '도착했어' 만 바꿨다.)
export const metadata: Metadata = {
  title: "마케팅 정보 수집 및 이용 동의",
  description: "도착했어의 마케팅 정보 수집 항목·이용 목적과 동의 철회 방법을 안내합니다.",
  alternates: { canonical: "/legal/marketing" },
};

export default function MarketingPage() {
  return (
    <LegalDocument title="마케팅 정보 수집 및 이용 동의" path="/legal/marketing">
      <section>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            {"개인정보의 수집 및 이용 목적"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"본인은 본 약관에 동의함으로써, 비욘드리얼 (이하 '회사' 라고 합니다)이 아래와 같은 개인정보를 수집, 이용하는 것에 동의합니다."}</li>
              <li>{"마케팅 및 광고에 활용: 신규 서비스(도착했어)의 제공 및 특화된 서비스 제공, 이벤트 등 광고성 정보 전달, 접속 빈도 파악 또는 회원의 서비스 이용에 대한 통계 등"}</li>
            </ul>
          </li>
          <li>
            {"수집하는 개인정보의 항목"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"이메일, 휴대전화번호, 서비스 이용기록, 접속 로그, 쿠키, 접속 IP 정보 등"}</li>
            </ul>
          </li>
          <li>
            {"개인정보의 보유 및 이용기간"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"본인이 회원 탈퇴를 요청하거나, 동의를 철회하는 경우까지"}</li>
            </ul>
          </li>
          <li>
            {"동의철회 및 개인정보의 삭제"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"본인은 언제든지 개인정보의 수집 및 이용에 대한 동의를 철회하고, 수집된 정보의 삭제를 요청하실 수 있습니다."}</li>
            </ul>
          </li>
          <li>
            {"동의 거부권 및 동의 거부에 따른 불이익"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"본인은 개인정보의 수집 및 이용에 대한 동의를 거부하실 권리가 있습니다. 다만, 필요한 최소한의 개인정보를 수집하지 못할 경우, 서비스 제공에 어려움이 있을 수 있습니다."}</li>
            </ul>
          </li>
        </ol>
      </section>
    </LegalDocument>
  );
}

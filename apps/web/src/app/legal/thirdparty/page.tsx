import type { Metadata } from "next";

import LegalDocument from "../LegalDocument";

// 원문: Notion 공개 문서 schedulemap.notion.site/3-21b302dcaba0490fbaa9430618a74f01
// 앱 이름 'smap' → '도착했어', 시행일 → 2026-01-08(최신 개정) 만 바꿨다.
export const metadata: Metadata = {
  title: "개인정보 제3자 제공 동의",
  description: "도착했어의 개인정보 제3자 제공 목적·항목·보유기간과 동의 거부 시 불이익을 안내합니다.",
  alternates: { canonical: "/legal/thirdparty" },
};

export default function ThirdPartyPage() {
  return (
    <LegalDocument title="개인정보 제3자 제공 동의" path="/legal/thirdparty" effectiveDate="2026-01-08">
      <section>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            {"제3자 제공의 목적"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"비욘드리얼 (이하 '회사' 라고 합니다)은 본인의 동의 하에 아래와 같은 본인의 개인정보를 제3자에게 제공합니다."}</li>
            </ul>
          </li>
          <li>
            {"제공받는 자의 이용 목적"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"제공받는 자는 본인의 개인정보를 아래와 같은 목적으로만 이용하며, 이를 벗어난 목적으로는 이용하지 않습니다."}</li>
              <li>{"마케팅 및 광고 활용: 신규 서비스(제품)의 제공 및 특화된 서비스 제공, 이벤트 등 광고성 정보 전달"}</li>
            </ul>
          </li>
          <li>
            {"제공하는 개인정보 항목"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"이메일, 휴대전화번호, 서비스 이용기록, 접속 로그, 쿠키, 접속 IP 정보 등"}</li>
            </ul>
          </li>
          <li>
            {"개인정보의 보유 및 이용기간"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"본인이 동의 철회를 요청하거나, 이용계약이 종료 될 때까지"}</li>
            </ul>
          </li>
          <li>
            {"동의 거부권 및 동의 거부에 따른 불이익"}
            <ul className="list-disc pl-5 space-y-1">
              <li>{"본인은 개인정보 제3자 제공에 대한 동의를 거부하실 권리가 있습니다. 다만, 동의를 거부할 경우 서비스 제공에 제한이 있을 수 있습니다."}</li>
            </ul>
          </li>
        </ol>
      </section>
    </LegalDocument>
  );
}

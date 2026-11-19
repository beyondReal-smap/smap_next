import type { ReactNode } from "react";

import JsonLd from "@/components/JsonLd";
import { breadcrumbNode, jsonLdGraph } from "@/lib/jsonld";

/**
 * 약관 문서 공통 틀 — 개인정보 처리방침(/legal/privacy)과 같은 카드 모양.
 *
 * 약관 4종(이용약관·위치기반서비스·제3자 제공·마케팅)은 본문만 다르고 틀이 같아서
 * 한 곳에 모았다. 본문은 각 page.tsx 가 children 으로 넘긴다.
 */
export default function LegalDocument({
  title,
  path,
  effectiveDate,
  children,
}: {
  title: string;
  path: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F7F9FC] pt-28 pb-20 px-4">
      <JsonLd
        data={jsonLdGraph([
          breadcrumbNode([
            { name: "홈", path: "/" },
            { name: title, path },
          ]),
        ])}
      />
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-10 text-sm leading-relaxed">
            <h1 className="text-2xl font-bold mb-2 text-center text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mb-8 text-center">시행일: {effectiveDate}</p>
            <div className="space-y-6 text-gray-800 leading-7">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

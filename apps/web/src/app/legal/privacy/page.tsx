import type { Metadata } from "next";

import JsonLd from "@/components/JsonLd";
import { findPage } from "@/content/pages";
import { breadcrumbNode, jsonLdGraph, webPageNode } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";

const page = findPage("privacy")!;

// layout의 template("%s | SMAP")이 브랜드를 붙이므로 제목에서 중복을 제거했습니다.
export const metadata: Metadata = pageMetadata(page, {
  title: "개인정보 처리방침",
  alternates: {
    markdown: { url: `/md/${page.slug}`, title: "개인정보 처리방침 (Markdown)" },
  },
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F5] pt-28 pb-20 px-4">
      <JsonLd
        data={jsonLdGraph([
          webPageNode(page),
          breadcrumbNode([
            { name: "홈", path: "/" },
            { name: "개인정보 처리방침", path: "/legal/privacy" },
          ]),
        ])}
      />
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-10 text-sm leading-relaxed">
            <h1 className="text-2xl font-bold mb-2 text-center text-gray-900">
              개인정보 처리방침
            </h1>
            <p className="text-sm text-gray-500 mb-8 text-center">
              시행일: 2026-01-08
            </p>

            <div className="space-y-6 text-gray-800 leading-7">
              <p>
                비욘드리얼("회사"라 함)는 이용자의 개인정보를 소중하게 생각하며,
                『개인정보 보호법』 및 『위치정보의 보호 및 이용 등에 관한 법률』 등
                관련 법령을 준수하고 있습니다.
              </p>

              <p>
                본 방침은 "smap" 서비스 이용 시 수집되는 위치 데이터를 포함한
                개인정보의 처리 과정을 상세히 공개합니다.
              </p>

              <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">
                1. 개인정보 수집 항목 및 이용목적
              </h2>
              <p>
                회사는 서비스 제공을 위해 아래와 같은 개인정보 및 기기 액세스
                권한을 수집·이용합니다.
              </p>

              <div className="overflow-x-auto mb-2">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                        구분
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                        수집 항목
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                        이용 목적
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 font-medium">
                        위치 정보 (필수)
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        실시간 GPS 위치 데이터, 이동 경로, 기기 위치 정보
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        그룹 내 실시간 위치 공유, 일정 장소 기반 알림, 위치 기반
                        서비스 제공
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 font-medium">
                        회원 정보 (필수)
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        이메일 주소, 비밀번호, 닉네임, 프로필 사진
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        서비스 가입 및 본인 확인, 사용자 식별
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 font-medium">
                        기기 정보 (필수)
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        단말기 식별번호(ID), OS 버전, 방문 기록
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        서비스 최적화 및 부정 이용 방지
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                <h4 className="font-semibold text-amber-800 mb-2">
                  [중요] 위치 정보 액세스 고지
                </h4>
                <p className="text-amber-900 text-sm mb-2">
                  "smap"은 앱이 닫혀 있거나 사용 중이 아닐 때도 실시간 위치 공유
                  기능을 지원하기 위해 위치 데이터를 수집합니다.
                </p>
                <p className="text-amber-900 text-sm">
                  이용자가 '항상 허용'으로 설정한 경우에 한해 백그라운드에서 위치
                  정보를 액세스하며, 이는 그룹 멤버 간의 원활한 일정 및 위치
                  공유를 위한 핵심 기능입니다.
                </p>
              </div>

              <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">
                2. 위치정보의 보호 및 이용 (추가)
              </h2>
              <p>
                회사는 위치기반서비스를 제공하기 위해 이용자의 위치정보를
                처리하며, 다음과 같은 원칙을 준수합니다.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>수집 방법:</strong> GPS, Wi-Fi, 기기 센서 등을 통해
                  실시간으로 수집합니다.
                </li>
                <li>
                  <strong>보유 및 이용:</strong> 이용 목적이 달성되거나 이용자가
                  동의를 철회할 경우 즉시 파기합니다. 단, 관련 법령에 따라 기록을
                  보존해야 하는 경우 해당 기간(예: 위치정보 이용·제공사실
                  확인자료 6개월) 동안 보관합니다.
                </li>
                <li>
                  <strong>이용자 권리:</strong> 이용자는 언제든지 위치 정보 수집에
                  대한 동의를 거부하거나 철회할 수 있으며, 이 경우 서비스의
                  일부(실시간 공유 등) 이용이 제한될 수 있습니다.
                </li>
              </ul>

              <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">
                3. 개인정보의 제3자에 대한 제공
              </h2>
              <p>회사는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.</p>
              <p>
                단, 그룹 공유 기능을 선택하여 이용자가 스스로 위치 정보를 그룹
                멤버에게 노출하는 경우는 예외로 합니다.
              </p>

              <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">
                4. 개인정보의 파기
              </h2>
              <p>
                개인정보는 수집 및 이용목적이 달성되면 지체 없이 파기합니다.
                전자적 파일 형태는 복구가 불가능한 기술적 방법을 사용하여
                삭제합니다.
              </p>

              <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">
                5. 개인정보 보호책임자
              </h2>
              <p>
                회사는 개인정보 및 위치정보와 관련한 고충 처리를 위하여 아래와
                같이 책임자를 지정하고 있습니다.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500">
                <h4 className="font-semibold mb-3 text-sm">개인정보 보호책임자</h4>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <strong>성명:</strong> 정진
                  </p>
                  <p>
                    <strong>전화:</strong> 070-8065-2207
                  </p>
                  <p>
                    <strong>이메일:</strong> admin@smap.site
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

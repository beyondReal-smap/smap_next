import type { Metadata } from "next";

import JsonLd from "@/components/JsonLd";
import { findPage } from "@/content/pages";
import { SITE } from "@/content/site";
import { breadcrumbNode, jsonLdGraph, webPageNode } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";

const page = findPage("account-deletion")!;

export const metadata: Metadata = pageMetadata(page, {
  title: "계정 삭제 안내",
  alternates: {
    markdown: { url: `/md/${page.slug}`, title: "계정 삭제 안내 (Markdown)" },
  },
});

const appName = SITE.name;
const supportEmail = SITE.email;

// react-icons 의존성 없이 사용할 인라인 아이콘 (smap-web에는 react-icons 미설치)
function IconSmartphone() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F5] text-gray-900 pt-28 pb-20 px-6">
      {/* 탈퇴 절차는 단계가 명확해 HowTo로 선언합니다.
          "SMAP 탈퇴하는 법" 같은 질의에 AI가 단계 그대로 답할 수 있게 됩니다. */}
      <JsonLd
        data={jsonLdGraph([
          webPageNode(page),
          {
            "@type": "HowTo",
            name: `${appName} 계정 삭제 방법`,
            description:
              "앱 내 설정에서 즉시 탈퇴하거나 이메일로 삭제를 요청할 수 있습니다.",
            step: [
              {
                "@type": "HowToStep",
                position: 1,
                name: "설정 열기",
                text: "앱 우측 하단 [설정] 아이콘을 클릭합니다.",
              },
              {
                "@type": "HowToStep",
                position: 2,
                name: "계정 관리 선택",
                text: "[계정 관리] 메뉴를 선택합니다.",
              },
              {
                "@type": "HowToStep",
                position: 3,
                name: "회원탈퇴 진행",
                text: "[회원탈퇴] 버튼을 클릭한 뒤 안내 절차를 진행합니다.",
              },
            ],
            supply: {
              "@type": "HowToSupply",
              name: `${appName} 앱 로그인 계정`,
            },
            totalTime: "PT3M",
          },
          breadcrumbNode([
            { name: "홈", path: "/" },
            { name: "계정 삭제 안내", path: "/account-deletion" },
          ]),
        ])}
      />
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            앱 계정 삭제 및 데이터 관리
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {appName}은 사용자의 개인정보 보호를 최우선으로 생각합니다.
            <br />
            언제든지 계정 및 관련 데이터의 삭제를 요청하실 수 있습니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Method 1: App Deletion */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
              <IconSmartphone />
            </div>
            <h2 className="text-2xl font-bold mb-4">앱 내에서 즉시 탈퇴</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              {appName} 앱에 로그인되어 있다면 설정 메뉴를 통해 즉시 계정을 삭제할
              수 있습니다.
            </p>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="font-bold mr-2">1.</span> 앱 우측 하단 [설정]
                아이콘 클릭
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">2.</span> [계정 관리] 메뉴 선택
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">3.</span> [회원탈퇴] 버튼 클릭 후
                절차 진행
              </li>
            </ol>
          </div>

          {/* Method 2: Manual Request */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
              <IconMail />
            </div>
            <h2 className="text-2xl font-bold mb-4">수동 삭제 요청</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              앱 접속이 불가능하거나 로그인이 안 되는 경우 이메일을 통해 데이터
              삭제를 요청하실 수 있습니다.
            </p>
            <div className="bg-gray-50 p-4 rounded-xl mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">
                고객센터 이메일
              </p>
              <a
                href={`mailto:${supportEmail}`}
                className="text-lg font-mono text-blue-600 hover:underline break-all"
              >
                {supportEmail}
              </a>
            </div>
            <p className="text-sm text-gray-500 italic">
              * 요청 시 계정 식별을 위해 가입하신 이메일 또는 전화번호를 반드시
              기재해 주세요.
            </p>
          </div>
        </div>

        {/* Data Policy Section */}
        <div className="bg-gray-900 text-white rounded-3xl p-8 sm:p-10 shadow-xl overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-8 flex items-center">
              <span className="mr-3 text-blue-400">
                <IconShield />
              </span>
              데이터 삭제 및 보관 정책
            </h2>

            <div className="grid md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <h3 className="text-blue-400 font-bold text-lg mb-2 flex items-center">
                    <span className="mr-2">
                      <IconTrash />
                    </span>{" "}
                    삭제되는 데이터
                  </h3>
                  <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
                    <li>사용자 프로필 (이름, 이메일, 전화번호, 사진)</li>
                    <li>모든 위치 추적 기록 및 장소 데이터</li>
                    <li>활동 로그 및 서비스 이용 기록</li>
                    <li>소셜 로그인 연동 정보</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-yellow-400 font-bold text-lg mb-2 flex items-center">
                    <span className="mr-2">
                      <IconInfo />
                    </span>{" "}
                    보관 정책
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    탈퇴 완료 시 개인정보는 즉시 파기됩니다. 단, 아래의 경우 법령
                    및 약관에 따라 일정 기간 보관됩니다.
                  </p>
                  <ul className="text-gray-300 text-xs space-y-2">
                    <li>
                      • 중복 가입 방지 및 부정 이용 확인 정보: 탈퇴 후 30일 보관
                    </li>
                    <li>• 전자상거래 소비자 보호 법령에 따른 기록: 5년 보관</li>
                    <li>• 서비스 로그 기록 (통신비밀보호법): 3개월 보관</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600 opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-600 opacity-10 rounded-full blur-3xl"></div>
        </div>

        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>© 2026 {appName}. All rights reserved.</p>
          <div className="mt-4">
            <a href="/legal/privacy" className="hover:text-gray-800 underline">
              개인정보처리방침
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}

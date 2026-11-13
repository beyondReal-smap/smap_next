import { FAQS, groupFaqsByCategory } from "./faq";
import { FEATURES } from "./features";
import { COMPANY, EXTERNAL_DOCS, PRICING, PROJECTS, SITE } from "./site";
import type { PageDoc } from "./types";

/**
 * 페이지별 AI-ready 마크다운 표현 (SSOT).
 *
 * HTML 페이지는 사람이 읽기 좋게 만들어져 있지만, 장식용 div와 SVG가 뒤섞여 있어
 * LLM이 파싱하면 신호 대비 잡음이 큽니다. 그래서 같은 내용을 마크다운으로 별도 제공합니다.
 *   - /md/{slug} 로 원문 노출 (llms.txt에서 링크)
 *   - /api/ai/pages/{slug} 로 메타데이터와 함께 JSON 제공
 *   - MCP smap_get_page 도구가 그대로 반환
 *
 * 마크다운 본문은 기능·FAQ 배열에서 파생시켜, 콘텐츠가 두 벌로 갈라지지 않게 했습니다.
 */

/** 콘텐츠 최종 검수일. 페이지별로 다르면 각 항목에서 덮어씁니다. */
const REVIEWED_AT = "2026-08-07";

function featuresMarkdown(): string {
  return FEATURES.map((feature) => {
    const details = feature.details
      .map((detail) => `- **${detail.title}**: ${detail.description}`)
      .join("\n");
    return `### ${feature.title} (${feature.category})\n\n${feature.summary}\n\n${details}`;
  }).join("\n\n");
}

function faqMarkdown(): string {
  return groupFaqsByCategory()
    .map(({ category, items }) => {
      const body = items
        .map((faq) => `**Q. ${faq.question}**\n\nA. ${faq.answer}`)
        .join("\n\n");
      return `### ${category}\n\n${body}`;
    })
    .join("\n\n");
}

const HOME_MARKDOWN = [
  "# " + COMPANY.name + " — " + COMPANY.tagline,
  COMPANY.description,
  "## 회사 소개",
  "비욘드리얼은 사람을 이해하는 AI와 즐겁게 배우는 교육 콘텐츠를 만드는 회사입니다.",
  "고객 분석, 맞춤 영어 동화, 게임형 수학 학습, 금융 문서 진단, 금융 리서치로 기술을 일상에 연결합니다.",
  "## 다섯 가지 프로젝트",
  ...PROJECTS.map((project) => "### " + project.name + " — " + project.label + "\n\n" + project.description + "\n\n- 특징: " + project.features.join(", ") + "\n- 공식 서비스: " + project.url),
  "## 만드는 방식",
  "1. 사람에서 시작합니다 — 누구의 어떤 문제를 풀 것인지 먼저 묻습니다.",
  "2. 기술로 가능성을 넓힙니다 — AI의 분석과 생성 능력을 실제 문제에 연결합니다.",
  "3. 경험으로 완성합니다 — 쉽게 이해하고 즐겁게 사용하는 경험을 다듬습니다.",
  "## 협업 문의",
  "- 이메일: " + COMPANY.email,
  "- 회사명: " + COMPANY.legalName,
  "- 대표: " + COMPANY.representative,
  "- 사업자등록번호: " + COMPANY.registrationNumber,
  "- 주소: " + COMPANY.address,
].join("\n\n");

const FEATURES_MARKDOWN = `# ${SITE.name} 주요 기능

자녀의 안전과 일정 관리를 위한 ${SITE.name}의 기능 ${FEATURES.length}가지입니다.

## 기능 목록

${featuresMarkdown()}

## 요약

${SITE.name}은 위치 공유(비공개 그룹·실시간 위치·안전구역 알림), 일정 관리(통합 캘린더·원격 등록·30분 전 알림), 이동(T-Map 연동 경로 안내·2주 이동 기록), 관리(그룹 권한·기간 설정·일일 요약)의 네 축으로 구성됩니다.
`;

const FAQ_MARKDOWN = `# ${SITE.name} 자주 묻는 질문

${SITE.name} 이용에 대해 가장 많이 묻는 질문 ${FAQS.length}개와 공식 답변입니다.

${faqMarkdown()}

## 더 알아보기

- 전체 FAQ 문서: ${EXTERNAL_DOCS.faq}
- 도움말 센터: ${EXTERNAL_DOCS.help}
- 문의 이메일: ${SITE.email}
`;

const CONTACT_MARKDOWN = `# ${SITE.name} 문의하기

${SITE.name}에 관한 질문, 제안, 오류 신고를 받는 공식 창구입니다.

## 연락 방법

- 이메일: ${SITE.email}
- 웹 문의 양식: ${SITE.name} 웹사이트의 문의하기 페이지에서 이름·이메일·문의 내용을 작성해 전송
- 전체 FAQ: ${EXTERNAL_DOCS.faq}

## 문의 전 확인하면 좋은 것

- 사용 가능한 기기: iOS와 Android 모두 지원합니다.
- 요금: ${PRICING.summary}
- 계정 삭제: 앱의 [설정] → [계정 관리] → [회원탈퇴]에서 즉시 처리할 수 있습니다.
`;

const PRIVACY_MARKDOWN = `# ${SITE.name} 개인정보 처리방침 요약

시행일 2026-01-08. 운영사 ${SITE.legalName}은 『개인정보 보호법』과 『위치정보의 보호 및 이용 등에 관한 법률』을 준수합니다. 아래는 요약이며, 법적 효력을 갖는 전문은 웹사이트의 개인정보 처리방침 페이지에 있습니다.

## 수집 항목과 이용 목적

| 구분 | 수집 항목 | 이용 목적 |
| --- | --- | --- |
| 위치 정보 (필수) | 실시간 GPS 위치 데이터, 이동 경로, 기기 위치 정보 | 그룹 내 실시간 위치 공유, 일정 장소 기반 알림, 위치 기반 서비스 제공 |
| 회원 정보 (필수) | 이메일 주소, 비밀번호, 닉네임, 프로필 사진 | 서비스 가입 및 본인 확인, 사용자 식별 |
| 기기 정보 (필수) | 단말기 식별번호(ID), OS 버전, 방문 기록 | 서비스 최적화 및 부정 이용 방지 |

## 백그라운드 위치 수집 고지

${SITE.name}은 앱이 닫혀 있거나 사용 중이 아닐 때도 실시간 위치 공유 기능을 지원하기 위해 위치 데이터를 수집합니다. 이용자가 '항상 허용'으로 설정한 경우에 한합니다.

## 위치정보 처리 원칙

- 수집 방법: GPS, Wi-Fi, 기기 센서를 통해 실시간 수집
- 보유·이용: 목적 달성 또는 동의 철회 시 즉시 파기. 단, 위치정보 이용·제공사실 확인자료 등 법령상 보존 의무가 있는 기록은 해당 기간(예: 6개월) 보관
- 이용자 권리: 언제든지 수집 동의를 거부·철회 가능. 이 경우 실시간 공유 등 일부 기능이 제한됨

## 제3자 제공

이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다. 이용자가 스스로 그룹 공유 기능을 선택해 그룹 멤버에게 위치를 노출하는 경우는 예외입니다.

## 문의

개인정보·위치정보 관련 고충 처리는 ${SITE.email}로 문의할 수 있습니다.
`;

const ACCOUNT_DELETION_MARKDOWN = `# ${SITE.name} 계정 삭제 및 데이터 관리

${SITE.name} 계정과 관련 데이터는 언제든지 삭제를 요청할 수 있습니다.

## 방법 1 — 앱 내에서 즉시 탈퇴

1. 앱 우측 하단 [설정] 아이콘 클릭
2. [계정 관리] 메뉴 선택
3. [회원탈퇴] 버튼 클릭 후 절차 진행

## 방법 2 — 이메일로 수동 삭제 요청

앱 접속이 불가능하거나 로그인이 되지 않는 경우 ${SITE.email}로 요청합니다. 계정 식별을 위해 가입한 이메일 또는 전화번호를 반드시 기재해야 합니다.

## 삭제되는 데이터

- 사용자 프로필 (이름, 이메일, 전화번호, 사진)
- 모든 위치 추적 기록 및 장소 데이터
- 활동 로그 및 서비스 이용 기록
- 소셜 로그인 연동 정보

## 법령에 따른 보관 정책

탈퇴 완료 시 개인정보는 즉시 파기됩니다. 단, 아래 항목은 법령 및 약관에 따라 일정 기간 보관됩니다.

- 중복 가입 방지 및 부정 이용 확인 정보: 탈퇴 후 30일
- 전자상거래 소비자 보호 법령에 따른 기록: 5년
- 서비스 로그 기록 (통신비밀보호법): 3개월
`;

export const PAGES: PageDoc[] = [
  {
    slug: "home",
    path: "/",
    title: COMPANY.name + " — " + COMPANY.tagline,
    description: COMPANY.description,
    summary: "비욘드리얼 회사 소개, 다섯 프로젝트, 만드는 방식과 협업 문의",
    markdown: HOME_MARKDOWN,
    keywords: ["비욘드리얼", "Beyondreal", "AI", "교육 콘텐츠", "PersonaFit", "하루책", "구구 어드벤처", "모의창구", "10percent", "Toss"],
    priority: 1,
    updatedAt: "2026-10-07",
  },
  {
    slug: "features",
    path: "/features",
    title: `${SITE.name} 주요 기능`,
    description: `실시간 위치 확인부터 T-Map 경로 안내, 안전구역 알림, 2주 이동 기록까지 ${SITE.name}의 기능 ${FEATURES.length}가지를 소개합니다.`,
    summary: `기능 ${FEATURES.length}종의 상세 설명과 하위 기능 항목`,
    markdown: FEATURES_MARKDOWN,
    keywords: [
      "SMAP 기능",
      "실시간 위치",
      "안전구역",
      "T맵 연동",
      "이동 기록",
      "일정 관리",
      "그룹 관리",
    ],
    priority: 0.9,
    updatedAt: REVIEWED_AT,
  },
  {
    slug: "faq",
    path: "/faq",
    title: `${SITE.name} 자주 묻는 질문`,
    description: `${SITE.name}의 지원 기기, 요금, 위치 정보 처리, 계정 삭제 등 자주 묻는 질문 ${FAQS.length}개에 대한 공식 답변입니다.`,
    summary: `질문 ${FAQS.length}개에 대한 공식 답변 (시작하기·기능·요금·개인정보·계정)`,
    markdown: FAQ_MARKDOWN,
    keywords: [
      "SMAP FAQ",
      "자주 묻는 질문",
      "SMAP 무료",
      "위치 권한",
      "계정 삭제",
      "지원 기기",
    ],
    priority: 0.9,
    updatedAt: REVIEWED_AT,
  },
  {
    slug: "contact",
    path: "/contact",
    title: `${SITE.name} 문의하기`,
    description: `${SITE.name}에 관한 질문이나 제안을 보내는 공식 창구입니다. 이메일 ${SITE.email} 또는 웹 문의 양식을 이용할 수 있습니다.`,
    summary: "문의 채널(이메일·웹 양식)과 문의 전 확인 사항",
    markdown: CONTACT_MARKDOWN,
    keywords: ["SMAP 문의", "고객센터", "연락처", "이메일 문의", "지원"],
    priority: 0.6,
    updatedAt: REVIEWED_AT,
  },
  {
    slug: "privacy",
    path: "/legal/privacy",
    title: `${SITE.name} 개인정보 처리방침`,
    description: `${SITE.name} 서비스의 개인정보 수집·이용·보관 및 위치정보 처리 방침을 안내합니다.`,
    summary: "수집 항목·이용 목적, 백그라운드 위치 수집 고지, 제3자 제공 원칙",
    markdown: PRIVACY_MARKDOWN,
    keywords: [
      "개인정보 처리방침",
      "위치정보",
      "수집 항목",
      "제3자 제공",
      "백그라운드 위치",
    ],
    priority: 0.5,
    updatedAt: "2026-01-08",
  },
  {
    slug: "account-deletion",
    path: "/account-deletion",
    title: `${SITE.name} 계정 삭제 안내`,
    description: `${SITE.name} 계정 및 관련 데이터 삭제 방법과 데이터 보관 정책을 안내합니다.`,
    summary: "앱 내 탈퇴 절차, 이메일 삭제 요청, 데이터 보관 기간",
    markdown: ACCOUNT_DELETION_MARKDOWN,
    keywords: [
      "계정 삭제",
      "회원탈퇴",
      "데이터 삭제",
      "보관 기간",
      "탈퇴 방법",
    ],
    priority: 0.5,
    updatedAt: REVIEWED_AT,
  },
];

/** slug로 페이지 단건 조회. */
export function findPage(slug: string): PageDoc | undefined {
  return PAGES.find((page) => page.slug === slug);
}

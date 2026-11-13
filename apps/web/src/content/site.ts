/**
 * 사이트 전역 상수 — 도메인·조직·앱 스토어·연락처의 단일 진실 공급원(SSOT).
 *
 * 여기 정의된 값이 다음 소비처 전체로 흘러갑니다.
 *   1) Next.js Metadata (title/description/openGraph/canonical)
 *   2) JSON-LD 구조화 데이터 (Organization / WebSite / MobileApplication)
 *   3) robots.txt · sitemap.xml
 *   4) /llms.txt · /llms-full.txt (AI 크롤러용 사이트 요약)
 *   5) /api/ai/* AI-ready JSON API → MCP 서버(apps/mcp)
 *
 * 배포 환경마다 도메인이 달라질 수 있어 NEXT_PUBLIC_SITE_URL로 덮어쓸 수 있게 했습니다.
 */

/** 정규 사이트 URL. 끝 슬래시 없음. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://smap.site"
).replace(/\/+$/, "");

/** 절대 URL 생성 헬퍼. AI 응답에는 상대 경로가 쓸모없으므로 항상 절대 경로로 노출합니다. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const COMPANY = {
  name: "Beyondreal",
  legalName: "비욘드리얼",
  tagline: "기술은 더 멀리. 일상은 더 가까이.",
  description:
    "비욘드리얼은 사람을 이해하는 AI와 즐겁게 배우는 교육 콘텐츠를 만듭니다. PersonaFit, 하루책, 구구 어드벤처, 모의창구, 10percent로 기술의 가능성을 누구나의 일상으로 연결합니다.",
  email: "admin@smap.site",
  logo: "/images/beyondreal/brand-mark.svg",
  ogImage: "/images/beyondreal/og-company.png",
  url: "https://smap.site",
  representative: "정진",
  registrationNumber: "208-07-09695",
  address: "경기도 김포시 김포한강9로75번길 66, 505-A237호",
} as const;

export const PROJECTS = [
  {
    id: "personafit",
    name: "PersonaFit",
    category: "ai",
    label: "AI 고객 분석",
    tagline: "고객을 이해하는 새로운 관점",
    description:
      "상품과 아이디어를 합성 한국인 페르소나와 연결합니다. 타겟 분석부터 가상 설문, 반응 비교까지. 고객을 만나기 전, 더 좋은 질문을 준비합니다.",
    features: ["타겟 분석", "가상 설문", "반응 비교"],
    url: "https://persona.smap.site",
    action: "PersonaFit 살펴보기",
  },
  {
    id: "harubook",
    name: "하루책",
    category: "education",
    label: "맞춤 영어 동화",
    tagline: "우리 아이만의 이야기가 시작되는 곳",
    description:
      "나이, 영어 수준, 관심사에 꼭 맞는 새로운 영어 동화. 읽고, 듣고, 퀴즈로 돌아보며 매일 한 권의 이야기가 즐거운 배움으로 이어집니다.",
    features: ["AI 맞춤 동화", "문장별 낭독", "단어 복습"],
    url: "https://eng.smap.site",
    action: "하루책 살펴보기",
  },
  {
    id: "gugu",
    name: "구구 어드벤처",
    category: "education",
    label: "게임으로 배우는 수학",
    tagline: "놀이가 배움이 되는 순간",
    description:
      "구구단을 외우는 대신, 모험을 떠납니다. 3D 월드와 다양한 게임 속에서 도전하고 성장하며, 어려웠던 곱셈이 어느새 자신감이 됩니다.",
    features: ["3D 모험", "구구단 게임", "오답 집중 학습"],
    url: "https://gugu.smap.site",
    action: "구구 어드벤처 살펴보기",
  },
  {
    id: "modu",
    name: "모의창구",
    category: "ai",
    label: "금융 문서 이해도 진단",
    tagline: "어려운 설명과 사람 사이의 간격을 좁히다",
    description:
      "금융상품 설명서를 가상 소비자의 관점에서 읽어봅니다. 이해가 어려운 부분과 오해를 살피고, 더 쉬운 설명을 준비하는 AI 시뮬레이션입니다.",
    features: ["이해도 진단", "오해 조항 분석", "쉬운 설명 초안"],
    url: "https://modu.smap.site",
    action: "모의창구 살펴보기",
  },
  {
    id: "toss",
    name: "10percent",
    category: "ai",
    label: "AI 금융 리서치 · Toss 프로젝트",
    tagline: "예측을 기록으로, 기록을 인사이트로",
    description:
      "AI 모델이 선별한 주식시장 후보와 모의투자 결과를 기록합니다. 후보, 거래, 성과를 함께 살피며 데이터로 가설을 검증하는 금융 리서치 프로젝트입니다.",
    features: ["AI 후보 분석", "모의투자 기록", "데이터 기반 검증"],
    url: "https://10percent.smap.site",
    action: "10percent 공개 기록 살펴보기",
  },
] as const;

export const SITE = {
  name: "SMAP",
  legalName: "비욘드리얼",
  /** 서비스 한 줄 정의 — AI가 "SMAP이 뭐야?"에 답할 때 그대로 인용되는 문장 */
  tagline: "자녀의 실시간 위치와 일정을 한 앱에서 확인하는 가족 안전 서비스",
  description:
    "SMAP은 부모가 자녀의 실시간 위치, 이동 경로, 일정을 하나의 앱에서 확인하고 관리할 수 있는 가족 위치·일정 공유 서비스입니다. 초대제 비공개 그룹, 안전구역 출입 알림, T-Map 연동 경로 안내, 2주간 이동 기록 조회를 제공하며 iOS와 Android에서 무료로 사용할 수 있습니다.",
  locale: "ko_KR",
  language: "ko",
  /** 서비스 제공 국가 (ISO 3166-1 alpha-2) */
  country: "KR",
  email: "admin@smap.site",
  logo: "/images/logo.png",
  /**
   * 공유 썸네일. 1200x630(약 1.91:1)은 페이스북·카카오·네이버·트위터가 공통으로 기대하는 규격입니다.
   * 기존에 쓰던 main.png는 950x1030 세로형이라 가로 카드에서 잘렸습니다.
   * og-default.png는 브랜드 배경 위에 로고를 배치해 규격에 맞춘 이미지입니다.
   * 디자인 시안이 나오면 같은 크기로 교체하면 됩니다.
   */
  ogImage: "/images/og-default.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  founded: "2024",
} as const;

/** 앱 스토어 배포 정보 — "어디서 받아?" 류 질의의 정답 데이터 */
export const APP_DISTRIBUTION = {
  ios: {
    platform: "iOS",
    store: "App Store",
    url: "https://apps.apple.com/kr/app/smap-%EC%9C%84%EC%B9%98%EC%B6%94%EC%A0%81-%EC%9D%B4%EB%8F%99%EA%B2%BD%EB%A1%9C-%EC%9D%BC%EC%A0%95/id6480279658",
    appId: "6480279658",
  },
  android: {
    platform: "Android",
    store: "Google Play",
    url: "https://play.google.com/store/apps/details?id=com.dmonster.smap",
    packageName: "com.dmonster.smap",
  },
} as const;

/** 가격 정책 — 구조화 데이터의 Offer와 FAQ 양쪽에서 참조 */
export const PRICING = {
  model: "freemium",
  basePrice: 0,
  currency: "KRW",
  summary:
    "기본 기능은 무료입니다. 일부 프리미엄 기능은 추가 요금이 발생할 수 있습니다.",
} as const;

/** 외부 문서(Notion) — 사이트 내부에 없는 1차 출처는 AI에게도 그대로 알려줍니다. */
export const EXTERNAL_DOCS = {
  faq: "https://schedulemap.notion.site/FAQ-8f37107b3c7c4307afd4297c7d71b5d5?pvs=4",
  help: "https://schedulemap.notion.site/SMAP-4afc9e6b71a6434cbcbf9dc4ec6f9d9d?pvs=4",
  terms:
    "https://schedulemap.notion.site/30b32b5ad0bc4f99a39b28c0fe5f1de4?pvs=4",
  privacy:
    "https://schedulemap.notion.site/2ac62e02f97b4d61945d68c2d89109e9?pvs=4",
  locationTerms:
    "https://schedulemap.notion.site/69cf94c6a04e471d8c3e3043f95baefb?pvs=4",
} as const;

/**
 * 검색엔진 웹마스터 도구 소유권 확인 코드.
 *
 * 구글 서치 콘솔·네이버 서치어드바이저·빙 웹마스터에 사이트를 등록하려면
 * 각 서비스가 발급한 코드를 메타태그로 노출해 소유권을 증명해야 합니다.
 * 등록 없이는 사이트맵을 제출할 수도, 색인 상태를 확인할 수도 없습니다.
 *
 * 코드는 환경변수로 주입합니다. 발급값이 배포 환경마다 다를 수 있고,
 * 값이 없을 때 빈 메타태그를 내보내면 검증이 오히려 실패하기 때문입니다.
 *
 * NEXT_PUBLIC_ 접두사를 쓰지 않습니다. 이 값들은 metadata 생성 과정,
 * 즉 서버에서만 읽히므로 클라이언트 번들에 넣을 이유가 없습니다.
 * 정적 생성 페이지에서는 빌드 시점 값이 HTML에 박히므로
 * `npm run build` **전에** 환경변수를 설정해야 합니다.
 */
export const SITE_VERIFICATION = {
  google: process.env.GOOGLE_SITE_VERIFICATION,
  naver: process.env.NAVER_SITE_VERIFICATION,
  bing: process.env.BING_SITE_VERIFICATION,
} as const;

/** AI 크롤러/에이전트가 진입점으로 삼을 기계 판독 경로 */
export const AI_ENDPOINTS = {
  llms: "/llms.txt",
  llmsFull: "/llms-full.txt",
  manifest: "/api/ai/manifest",
  pages: "/api/ai/pages",
  page: "/api/ai/pages/{slug}",
  markdown: "/md/{slug}",
  search: "/api/ai/search?q={query}",
  features: "/api/ai/features",
  faq: "/api/ai/faq",
  mcp: "/.well-known/mcp.json",
  rss: "/rss.xml",
} as const;

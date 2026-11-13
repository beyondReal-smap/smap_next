/**
 * AI-ready 콘텐츠 스키마.
 *
 * 웹 페이지 렌더링과 AI 소비(JSON API / llms.txt / MCP)가 같은 타입을 공유하도록 정의합니다.
 * 문자열 dict 대신 타입을 강제하는 이유: 필드가 하나 빠지면 AI 응답에서 조용히 누락되는 대신
 * 빌드 타임에 실패하게 만들기 위함입니다.
 */

/** 기능 하위 항목 (기능 상세 페이지의 체크리스트 한 줄) */
export interface FeatureDetail {
  title: string;
  description: string;
}

/** 제품 기능 하나 */
export interface Feature {
  /** URL·앵커·MCP 조회 키로 쓰이는 안정적인 식별자 */
  id: string;
  /** 분류 태그 (예: 프라이버시 보호) */
  category: string;
  title: string;
  /** 한 문장 요약 — AI가 인용하기 좋은 길이로 유지 */
  summary: string;
  details: FeatureDetail[];
  /** 이 기능을 설명하는 페이지 경로 */
  href: string;
  /** 검색 매칭을 넓히기 위한 동의어·연관어 */
  keywords: string[];
}

/** 자주 묻는 질문 하나 */
export interface Faq {
  id: string;
  question: string;
  /** 마크다운 없이 평문. FAQPage JSON-LD의 answer로 그대로 들어갑니다. */
  answer: string;
  category: FaqCategory;
  keywords: string[];
}

export type FaqCategory =
  | "시작하기"
  | "기능"
  | "요금"
  | "개인정보·보안"
  | "계정";

/** 사이트의 한 페이지에 대한 기계 판독 표현 */
export interface PageDoc {
  /** URL 경로에서 파생한 식별자 (예: "features"). 홈은 "home" */
  slug: string;
  path: string;
  title: string;
  description: string;
  /** llms.txt 목록에 노출할 한 줄 설명 */
  summary: string;
  /** 페이지 본문의 마크다운 표현. AI가 실제로 읽는 콘텐츠 */
  markdown: string;
  keywords: string[];
  /** sitemap 우선순위 산정과 AI의 중요도 판단에 사용 */
  priority: number;
  /** ISO 8601 날짜. 콘텐츠 신선도 신호 */
  updatedAt: string;
}

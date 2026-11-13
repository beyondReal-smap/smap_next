import type { MetadataRoute } from "next";

import { AI_ENDPOINTS, SITE_URL, absoluteUrl } from "@/content/site";

/**
 * robots.txt — 검색엔진과 AI 크롤러 접근 정책.
 *
 * 대상이 두 갈래입니다.
 *   1. 전통 검색엔진 (구글·네이버·다음·빙) — 색인과 순위
 *   2. AI 크롤러 (GPTBot·ClaudeBot·PerplexityBot 등) — 생성형 답변에서의 인용
 * SMAP은 공개 마케팅 사이트이므로 양쪽 모두에 전면 개방합니다.
 *
 * 중요: /_next/ 를 통째로 막으면 안 됩니다.
 * 페이지의 CSS와 JS가 /_next/static/ 아래 있어서, 차단하면 구글봇이 페이지를 렌더링하지 못합니다.
 * 구글은 렌더링 결과로 색인·모바일 친화성을 판단하므로 순위에 직접 손해입니다.
 * 그래서 크롤링해도 의미가 없고 노출되면 곤란한 경로만 좁게 막습니다.
 */

/** 국내외 주요 검색엔진 크롤러 — 명시적으로 허용해 의도를 분명히 합니다. */
const SEARCH_ENGINE_CRAWLERS = [
  // 구글: 본문 색인 + 이미지 색인 + 렌더링용 리소스 접근
  "Googlebot",
  "Googlebot-Image",
  "Googlebot-News",
  "Storebot-Google",
  // 네이버: Yeti가 네이버 검색의 공식 크롤러입니다.
  "Yeti",
  "NaverBot",
  // 다음/카카오
  "Daum",
  "Daumoa",
  // 마이크로소프트 (Bing 및 Copilot 답변의 근거)
  "bingbot",
  "msnbot",
  // 기타
  "DuckDuckBot",
  "Slurp",
];

/** 학습 데이터 수집형 AI 크롤러 */
const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "Timpibot",
  "Webzio-Extended",
];

/** 사용자 질의에 실시간으로 답하며 원문을 인용하는 크롤러/에이전트 */
const AI_ANSWER_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "MistralAI-User",
  "DuckAssistBot",
  "YouBot",
  "Meta-ExternalFetcher",
  "Applebot",
];

/**
 * 차단 경로.
 * - /api/contact: 문의 제출 엔드포인트. 색인 가치가 없고 크롤러가 POST를 흉내 낼 이유도 없습니다.
 * - /_next/static/ 등 렌더링에 필요한 리소스는 의도적으로 차단하지 않습니다.
 */
const DISALLOWED = ["/api/contact"];

/** 사람이 읽는 페이지 + 기계 판독 경로를 함께 허용합니다. */
const ALLOWED = [
  "/",
  // 구글봇이 페이지를 렌더링하려면 반드시 필요합니다.
  "/_next/static/",
  "/_next/image",
  AI_ENDPOINTS.llms,
  AI_ENDPOINTS.llmsFull,
  "/md/",
  "/api/ai/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOWED, disallow: DISALLOWED },
      ...SEARCH_ENGINE_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ALLOWED,
        disallow: DISALLOWED,
      })),
      ...AI_TRAINING_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ALLOWED,
        disallow: DISALLOWED,
      })),
      ...AI_ANSWER_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ALLOWED,
        disallow: DISALLOWED,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}

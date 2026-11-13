import { FAQS } from "./faq";
import { FEATURES } from "./features";
import { PAGES } from "./pages";

/**
 * 콘텐츠 통합 검색.
 *
 * AI 에이전트는 "SMAP 요금제 알려줘" 같은 자연어 질의를 그대로 던지므로,
 * 정확 일치보다 부분 일치 + 필드 가중치 방식이 재현율 면에서 유리합니다.
 * 콘텐츠 규모가 수십 건 수준이라 인메모리 선형 스캔으로 충분하며,
 * 외부 검색엔진 의존성을 만들지 않는 편이 배포·운영이 단순합니다.
 */

export type SearchResultType = "page" | "feature" | "faq";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  /** 결과 요약 — AI가 본문을 더 읽을지 판단하는 근거 */
  snippet: string;
  /** 사이트 내 경로 (상대). 호출부에서 절대 URL로 변환합니다. */
  path: string;
  /** 전문을 가져올 수 있는 경로. 없으면 snippet이 곧 전문입니다. */
  source?: string;
  score: number;
}

/** 질의를 공백 기준 토큰으로 정규화. 한국어는 어간 분리 없이 원형 매칭으로 처리합니다. */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * 토큰이 텍스트에 얼마나 걸리는지 점수화.
 * 가중치는 필드 신뢰도 순서(제목 > 키워드 > 본문)를 반영합니다.
 */
function scoreText(tokens: string[], text: string, weight: number): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += weight;
    }
  }
  return score;
}

/** 매칭 위치 주변을 잘라 스니펫 생성. 매칭이 없으면 앞부분을 반환합니다. */
function buildSnippet(text: string, tokens: string[], length = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const lowered = flat.toLowerCase();
  const hit = tokens
    .map((token) => lowered.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (hit === undefined || hit < length / 2) {
    return flat.slice(0, length) + (flat.length > length ? "…" : "");
  }
  const start = Math.max(0, hit - Math.floor(length / 3));
  return `…${flat.slice(start, start + length)}${
    start + length < flat.length ? "…" : ""
  }`;
}

export interface SearchOptions {
  /** 반환 최대 건수 */
  limit?: number;
  /** 특정 타입만 조회 */
  types?: SearchResultType[];
}

export function searchContent(
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const { limit = 10, types } = options;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const wanted = (type: SearchResultType) => !types || types.includes(type);
  const results: SearchResult[] = [];

  if (wanted("faq")) {
    for (const faq of FAQS) {
      const score =
        scoreText(tokens, faq.question, 6) +
        scoreText(tokens, faq.keywords.join(" "), 4) +
        scoreText(tokens, faq.answer, 2);
      if (score > 0) {
        results.push({
          type: "faq",
          id: faq.id,
          title: faq.question,
          snippet: faq.answer,
          path: `/faq#${faq.id}`,
          score,
        });
      }
    }
  }

  if (wanted("feature")) {
    for (const feature of FEATURES) {
      const detailText = feature.details
        .map((detail) => `${detail.title} ${detail.description}`)
        .join(" ");
      const score =
        scoreText(tokens, feature.title, 5) +
        scoreText(tokens, feature.keywords.join(" "), 4) +
        scoreText(tokens, feature.summary, 3) +
        scoreText(tokens, detailText, 1);
      if (score > 0) {
        results.push({
          type: "feature",
          id: feature.id,
          title: feature.title,
          snippet: feature.summary,
          path: feature.href,
          source: "/api/ai/features",
          score,
        });
      }
    }
  }

  if (wanted("page")) {
    for (const page of PAGES) {
      const score =
        scoreText(tokens, page.title, 5) +
        scoreText(tokens, page.keywords.join(" "), 4) +
        scoreText(tokens, page.description, 2) +
        scoreText(tokens, page.markdown, 1);
      if (score > 0) {
        results.push({
          type: "page",
          id: page.slug,
          title: page.title,
          snippet: buildSnippet(page.markdown, tokens),
          path: page.path,
          source: `/md/${page.slug}`,
          score,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

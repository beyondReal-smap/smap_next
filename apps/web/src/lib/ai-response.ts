import { SITE, SITE_URL } from "@/content/site";

/**
 * /api/ai/* 응답 공통 처리.
 *
 * 이 API군은 전부 공개된 마케팅 콘텐츠만 다루는 읽기 전용 엔드포인트입니다.
 * 그래서 CORS를 전면 허용합니다 — 브라우저 기반 AI 에이전트나 웹 IDE에서
 * 직접 fetch할 수 있어야 MCP 없이도 활용 가능하기 때문입니다.
 * 인증이 필요한 데이터는 이 경로에 절대 올리지 않습니다.
 */

export interface AiEnvelope<T> {
  /** 응답 스키마 버전. 소비자(MCP·외부 에이전트)가 호환성을 판단하는 근거 */
  schemaVersion: "1.0";
  service: string;
  /** 데이터가 유래한 정규 URL */
  source: string;
  /** ISO 8601 생성 시각 */
  generatedAt: string;
  data: T;
}

/** 캐시 정책 — 콘텐츠가 상수라 브라우저 1시간, CDN 1일로 넉넉히 잡습니다. */
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function aiJson<T>(data: T, init: { path: string; status?: number }) {
  const body: AiEnvelope<T> = {
    schemaVersion: "1.0",
    service: SITE.name,
    source: `${SITE_URL}${init.path}`,
    generatedAt: new Date().toISOString(),
    data,
  };

  return Response.json(body, {
    status: init.status ?? 200,
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "X-Robots-Tag": "all",
      ...CORS_HEADERS,
    },
  });
}

/**
 * 오류도 같은 봉투로 반환합니다.
 * 에이전트는 상태 코드만으로 원인을 구분하지 못하므로, 무엇이 잘못됐고
 * 무엇을 대신 호출하면 되는지를 본문에 명시해 자기 수정이 가능하게 합니다.
 */
export function aiError(
  message: string,
  init: { path: string; status: number; hint?: string },
) {
  return Response.json(
    {
      schemaVersion: "1.0" as const,
      service: SITE.name,
      source: `${SITE_URL}${init.path}`,
      generatedAt: new Date().toISOString(),
      error: { message, hint: init.hint },
    },
    {
      status: init.status,
      headers: { "Cache-Control": "no-store", ...CORS_HEADERS },
    },
  );
}

/**
 * CORS preflight 응답.
 *
 * 쿼리 파라미터를 읽어 어차피 동적으로 렌더되는 라우트(search·faq)에만 붙입니다.
 * 나머지 라우트에 OPTIONS를 export하면 Next.js가 해당 라우트 전체를 동적으로 전환해
 * 빌드 타임 정적 생성을 포기하게 됩니다. 이 API들은 인증 헤더가 없는 단순 GET이라
 * 브라우저가 preflight를 보내지 않으므로, 정적화를 택하는 편이 이득입니다.
 */
export function aiOptions() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" },
  });
}

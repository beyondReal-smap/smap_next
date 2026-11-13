import { searchContent, type SearchResultType } from "@/content/search";
import { absoluteUrl } from "@/content/site";
import { aiError, aiJson, aiOptions } from "@/lib/ai-response";

/**
 * /api/ai/search — 페이지·기능·FAQ 통합 검색.
 *
 * 질의 문자열이 외부 입력이므로 길이와 타입 파라미터를 경계에서 검증합니다.
 * 검색 자체는 인메모리라 주입 위험은 없지만, 비정상 입력을 조용히 통과시키면
 * 에이전트가 빈 결과를 받고 원인을 모른 채 재시도하게 됩니다.
 */
export const dynamic = "force-dynamic";

const PATH = "/api/ai/search";
const VALID_TYPES: SearchResultType[] = ["page", "feature", "faq"];
const MAX_QUERY_LENGTH = 200;
const MAX_LIMIT = 25;

function parseTypes(raw: string | null): SearchResultType[] | undefined {
  if (!raw) return undefined;
  const requested = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const valid = requested.filter((value): value is SearchResultType =>
    VALID_TYPES.includes(value as SearchResultType),
  );
  return valid.length > 0 ? valid : undefined;
}

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) return 10;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();

  if (!query) {
    return aiError("검색어(q)가 필요합니다.", {
      path: PATH,
      status: 400,
      hint: `예: ${absoluteUrl("/api/ai/search?q=안전구역 알림")}`,
    });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return aiError(
      `검색어가 너무 깁니다. ${MAX_QUERY_LENGTH}자 이내로 줄여주세요.`,
      { path: PATH, status: 400 },
    );
  }

  const requestedTypes = url.searchParams.get("type");
  const types = parseTypes(requestedTypes);

  if (requestedTypes && !types) {
    return aiError(`type 값이 올바르지 않습니다: "${requestedTypes}"`, {
      path: PATH,
      status: 400,
      hint: `허용 값: ${VALID_TYPES.join(", ")} (쉼표로 복수 지정 가능)`,
    });
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const results = searchContent(query, { limit, types });

  return aiJson(
    {
      query,
      types: types ?? VALID_TYPES,
      count: results.length,
      results: results.map((result) => ({
        type: result.type,
        id: result.id,
        title: result.title,
        snippet: result.snippet,
        url: absoluteUrl(result.path),
        source: result.source ? absoluteUrl(result.source) : undefined,
        score: result.score,
      })),
      // 빈 결과일 때 에이전트가 다음 행동을 정하도록 대안을 제시합니다.
      fallback:
        results.length === 0
          ? {
              message: "일치하는 콘텐츠가 없습니다.",
              suggestions: [
                absoluteUrl("/api/ai/faq"),
                absoluteUrl("/api/ai/features"),
                absoluteUrl("/llms-full.txt"),
              ],
            }
          : undefined,
    },
    { path: PATH },
  );
}

export const OPTIONS = aiOptions;

import { FEATURES } from "@/content/features";
import { absoluteUrl } from "@/content/site";
import { aiJson } from "@/lib/ai-response";

/**
 * /api/ai/features — 제품 기능 카탈로그.
 *
 * "SMAP으로 뭘 할 수 있어?" 류 질문에 에이전트가 근거를 갖고 답하도록
 * 기능별 요약과 하위 항목을 구조화해 제공합니다.
 */
export const dynamic = "force-static";

const PATH = "/api/ai/features";

export function GET() {
  return aiJson(
    {
      count: FEATURES.length,
      features: FEATURES.map((feature) => ({
        id: feature.id,
        category: feature.category,
        title: feature.title,
        summary: feature.summary,
        details: feature.details,
        keywords: feature.keywords,
        url: absoluteUrl(feature.href),
      })),
    },
    { path: PATH },
  );
}


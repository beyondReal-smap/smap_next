import { PAGES } from "@/content/pages";
import { absoluteUrl } from "@/content/site";
import { aiJson } from "@/lib/ai-response";

/**
 * /api/ai/pages — 페이지 목록.
 *
 * 본문(markdown)은 일부러 빼고 메타데이터만 반환합니다.
 * 에이전트가 목록을 훑고 필요한 문서만 골라 받게 해서 컨텍스트 낭비를 줄입니다.
 */
export const dynamic = "force-static";

const PATH = "/api/ai/pages";

export function GET() {
  return aiJson(
    {
      pages: PAGES.map((page) => ({
        slug: page.slug,
        title: page.title,
        description: page.description,
        summary: page.summary,
        keywords: page.keywords,
        updatedAt: page.updatedAt,
        priority: page.priority,
        urls: {
          html: absoluteUrl(page.path),
          markdown: absoluteUrl(`/md/${page.slug}`),
          json: absoluteUrl(`/api/ai/pages/${page.slug}`),
        },
      })),
    },
    { path: PATH },
  );
}


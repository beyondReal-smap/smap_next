import { PAGES, findPage } from "@/content/pages";
import { absoluteUrl } from "@/content/site";
import { aiError, aiJson } from "@/lib/ai-response";

/**
 * /api/ai/pages/{slug} — 페이지 단건. 마크다운 본문 포함.
 *
 * MCP의 smap_get_page 도구가 그대로 감싸는 엔드포인트입니다.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return PAGES.map((page) => ({ slug: page.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const path = `/api/ai/pages/${slug}`;
  const page = findPage(slug);

  if (!page) {
    return aiError(`"${slug}" 페이지를 찾을 수 없습니다.`, {
      path,
      status: 404,
      hint: `사용 가능한 slug: ${PAGES.map((item) => item.slug).join(", ")}`,
    });
  }

  return aiJson(
    {
      slug: page.slug,
      title: page.title,
      description: page.description,
      summary: page.summary,
      keywords: page.keywords,
      updatedAt: page.updatedAt,
      content: {
        format: "markdown",
        body: page.markdown,
      },
      urls: {
        html: absoluteUrl(page.path),
        markdown: absoluteUrl(`/md/${page.slug}`),
      },
    },
    { path },
  );
}


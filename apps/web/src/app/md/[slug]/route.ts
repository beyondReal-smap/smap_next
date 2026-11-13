import { PAGES, findPage } from "@/content/pages";
import { absoluteUrl } from "@/content/site";

/**
 * /md/{slug} — 페이지의 마크다운 표현.
 *
 * HTML 페이지는 레이아웃·아이콘·애니메이션 마크업이 본문보다 많아 LLM 파싱 효율이 나쁩니다.
 * 같은 내용을 마크다운으로 제공해 토큰당 정보 밀도를 높입니다.
 *
 * 중복 콘텐츠 취급을 피하려고 Link 헤더로 원본 HTML을 canonical로 지정합니다.
 * (본문 마크다운에는 <link> 태그를 넣을 수 없으므로 HTTP 헤더를 사용)
 */
export const dynamic = "force-static";

/** 빌드 타임에 모든 슬러그를 정적 생성합니다. 콘텐츠가 상수라 런타임 계산이 불필요합니다. */
export function generateStaticParams() {
  return PAGES.map((page) => ({ slug: page.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const page = findPage(slug);

  if (!page) {
    const available = PAGES.map((item) => item.slug).join(", ");
    return new Response(
      `# 404 Not Found\n\n"${slug}" 문서를 찾을 수 없습니다.\n\n사용 가능한 slug: ${available}\n색인: ${absoluteUrl("/llms.txt")}\n`,
      {
        status: 404,
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      },
    );
  }

  const body = `${page.markdown.trim()}

---

- 원문 페이지: ${absoluteUrl(page.path)}
- 최종 검수일: ${page.updatedAt}
- 사이트 색인: ${absoluteUrl("/llms.txt")}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      Link: `<${absoluteUrl(page.path)}>; rel="canonical"`,
      "X-Robots-Tag": "all",
    },
  });
}

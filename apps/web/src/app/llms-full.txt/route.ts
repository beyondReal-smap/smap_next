import { PAGES } from "@/content/pages";
import { COMPANY, absoluteUrl } from "@/content/site";

/**
 * /llms-full.txt — 전 페이지 마크다운 전문을 한 파일로 합칩니다.
 *
 * /llms.txt가 목차라면 이 파일은 본문입니다. 에이전트가 링크를 따라가며
 * 여러 번 왕복하는 대신 한 번의 fetch로 전체 맥락을 확보할 수 있게 합니다.
 * 사이트 규모가 작아(6페이지) 전문을 합쳐도 컨텍스트 부담이 크지 않습니다.
 */
export const dynamic = "force-static";

function buildLlmsFullTxt(): string {
  const sections = PAGES.map((page) => {
    const meta = [
      `출처: ${absoluteUrl(page.path)}`,
      `최종 검수: ${page.updatedAt}`,
    ].join(" | ");
    return `---\n\n${meta}\n\n${page.markdown.trim()}`;
  }).join("\n\n");

  return `# ${COMPANY.name} — 전체 콘텐츠

${COMPANY.description}

이 문서는 ${absoluteUrl("/")} 의 모든 공개 페이지를 마크다운으로 합친 것입니다.
목차와 API 진입점은 ${absoluteUrl("/llms.txt")} 를 참고하세요.

${sections}
`;
}

export function GET(): Response {
  return new Response(buildLlmsFullTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "all",
    },
  });
}

import { PAGES } from "@/content/pages";
import { SITE, absoluteUrl } from "@/content/site";

/**
 * /rss.xml — RSS 2.0 피드.
 *
 * 네이버 서치어드바이저는 사이트맵 외에 RSS도 수집 채널로 받습니다.
 * 두 채널을 모두 제출하면 신규·변경 페이지가 색인에 반영되는 속도가 빨라집니다.
 * 구글은 사이트맵만으로 충분하지만, RSS를 추가로 제출해도 무해합니다.
 *
 * 콘텐츠 사이트가 아니라 페이지 수가 적고 변경도 잦지 않지만,
 * 페이지가 갱신되면 lastModified가 함께 올라가 수집 신호로 작동합니다.
 */
export const dynamic = "force-static";

/**
 * XML 특수문자 이스케이프.
 * 제목·설명에 &나 <가 들어가면 피드 전체가 파싱 실패합니다.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS는 RFC 822 형식의 날짜를 요구합니다. ISO 날짜로는 파서가 거부할 수 있습니다. */
function toRfc822(dateString: string): string {
  return new Date(`${dateString}T00:00:00+09:00`).toUTCString();
}

function buildRss(): string {
  const items = PAGES.map((page) => {
    const url = absoluteUrl(page.path);
    return `    <item>
      <title>${escapeXml(page.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(page.description)}</description>
      <pubDate>${toRfc822(page.updatedAt)}</pubDate>
      <category>${escapeXml(page.keywords[0] ?? SITE.name)}</category>
    </item>`;
  }).join("\n");

  // 가장 최근에 갱신된 페이지 시각을 피드의 lastBuildDate로 씁니다.
  const latest = PAGES.reduce(
    (acc, page) => (page.updatedAt > acc ? page.updatedAt : acc),
    PAGES[0]?.updatedAt ?? "2026-01-01",
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${SITE.name} - ${SITE.tagline}`)}</title>
    <link>${absoluteUrl("/")}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>ko-KR</language>
    <copyright>${escapeXml(SITE.legalName)}</copyright>
    <lastBuildDate>${toRfc822(latest)}</lastBuildDate>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export function GET(): Response {
  return new Response(buildRss(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "all",
    },
  });
}

import type { MetadataRoute } from "next";

import { PAGES } from "@/content/pages";
import { absoluteUrl } from "@/content/site";

/**
 * sitemap.xml — 사람용 HTML 페이지와 AI용 마크다운 표현을 모두 등재합니다.
 *
 * 마크다운 경로까지 넣는 이유: 크롤러가 llms.txt를 읽지 않더라도 sitemap만 보고
 * 정제된 표현에 도달할 수 있게 하기 위함입니다. 중복 콘텐츠로 오인되지 않도록
 * 마크다운 쪽 우선순위를 낮추고, /md/* 응답에는 원본 HTML을 가리키는 canonical 링크를 넣습니다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const htmlPages: MetadataRoute.Sitemap = PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(page.updatedAt),
    changeFrequency: page.priority >= 0.9 ? "weekly" : "monthly",
    priority: page.priority,
  }));

  const markdownPages: MetadataRoute.Sitemap = PAGES.map((page) => ({
    url: absoluteUrl(`/md/${page.slug}`),
    lastModified: new Date(page.updatedAt),
    changeFrequency: "monthly",
    priority: 0.3,
  }));

  // 사이트맵의 lastModified는 페이지 검수일에서 파생시킵니다.
  // new Date()를 쓰면 빌드할 때마다 전 항목이 "방금 수정됨"으로 바뀌어
  // 크롤러가 변경 신호를 신뢰하지 않게 됩니다.
  const latest = new Date(
    PAGES.reduce(
      (acc, page) => (page.updatedAt > acc ? page.updatedAt : acc),
      PAGES[0]?.updatedAt ?? "2026-01-01",
    ),
  );

  const aiEntrypoints: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/llms.txt"),
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: absoluteUrl("/llms-full.txt"),
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  return [...htmlPages, ...markdownPages, ...aiEntrypoints];
}

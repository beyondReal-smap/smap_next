import type { Metadata } from "next";

import { SITE, absoluteUrl } from "@/content/site";
import type { PageDoc } from "@/content/types";

/**
 * 페이지 Metadata 빌더.
 *
 * Next.js의 metadata 병합은 얕습니다. 페이지에서 openGraph를 정의하면
 * layout의 openGraph 객체 전체가 교체되어 og:image·og:site_name·og:locale이 사라집니다.
 * 실제로 그 사고가 나서, 페이지별 메타데이터는 반드시 이 헬퍼를 거치도록 통일했습니다.
 *
 * SNS 카드와 AI 요약 모두 og:image·og:site_name을 신뢰 신호로 쓰기 때문에
 * 누락되면 링크 미리보기가 비고 출처 표기도 약해집니다.
 */

export interface PageMetadataOptions {
  /** 브라우저 탭에 표시할 제목. layout의 "%s | SMAP" 템플릿이 적용됩니다. */
  title: string;
  /** 홈처럼 브랜드 접미사를 붙이면 어색한 경우 true */
  titleIsAbsolute?: boolean;
  /** og:type. 정적 문서는 article, 홈은 website */
  ogType?: "website" | "article";
  /** 이 페이지의 대체 표현(마크다운·JSON) */
  alternates?: {
    markdown?: { url: string; title: string };
    json?: { url: string; title: string };
  };
}

export function pageMetadata(
  page: PageDoc,
  options: PageMetadataOptions,
): Metadata {
  const { title, titleIsAbsolute, ogType = "article", alternates } = options;

  const types: NonNullable<
    NonNullable<Metadata["alternates"]>["types"]
  > = {};
  if (alternates?.markdown) {
    types["text/markdown"] = [alternates.markdown];
  }
  if (alternates?.json) {
    types["application/json"] = [alternates.json];
  }

  return {
    title: titleIsAbsolute ? { absolute: title } : title,
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: page.path,
      ...(Object.keys(types).length > 0 ? { types } : {}),
    },
    openGraph: {
      type: ogType,
      // layout에서 정의한 값이 교체되므로 여기서 매번 다시 채워 넣습니다.
      siteName: SITE.name,
      locale: SITE.locale,
      url: absoluteUrl(page.path),
      title: titleIsAbsolute ? title : `${title} | ${SITE.name}`,
      description: page.description,
      images: [
        {
          url: SITE.ogImage,
          width: SITE.ogImageWidth,
          height: SITE.ogImageHeight,
          alt: page.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titleIsAbsolute ? title : `${title} | ${SITE.name}`,
      description: page.description,
      images: [SITE.ogImage],
    },
  };
}

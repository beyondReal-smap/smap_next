import type { Metadata } from "next";

import FeaturesContent from "./FeaturesContent";
import JsonLd from "@/components/JsonLd";
import { FEATURES } from "@/content/features";
import { findPage } from "@/content/pages";
import { SITE, absoluteUrl } from "@/content/site";
import {
  breadcrumbNode,
  jsonLdGraph,
  webPageNode,
  type JsonLdNode,
} from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";

/**
 * /features 라우트 — 서버 컴포넌트.
 * 본문은 스크롤 제어 때문에 클라이언트로 분리하고, 메타데이터·구조화 데이터는 여기서 내보냅니다.
 */

const page = findPage("features")!;

export const metadata: Metadata = pageMetadata(page, {
  title: "주요 기능",
  alternates: {
    markdown: { url: `/md/${page.slug}`, title: "주요 기능 (Markdown)" },
    json: { url: "/api/ai/features", title: "기능 목록 (JSON)" },
  },
});

/**
 * 기능을 ItemList로 선언합니다.
 * 개별 기능이 앵커 URL을 갖는 독립 항목임을 알려야 AI가
 * "SMAP의 안전구역 알림"처럼 기능 단위로 인용하고 링크할 수 있습니다.
 */
function featureListNode(): JsonLdNode {
  return {
    "@type": "ItemList",
    "@id": `${absoluteUrl(page.path)}#featurelist`,
    name: `${SITE.name} 기능 목록`,
    numberOfItems: FEATURES.length,
    itemListElement: FEATURES.map((feature, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: feature.title,
      description: feature.summary,
      url: absoluteUrl(feature.href),
    })),
  };
}

export default function FeaturesPage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph([
          webPageNode(page),
          featureListNode(),
          breadcrumbNode([
            { name: "홈", path: "/" },
            { name: "주요 기능", path: "/features" },
          ]),
        ])}
      />
      <FeaturesContent />
    </>
  );
}

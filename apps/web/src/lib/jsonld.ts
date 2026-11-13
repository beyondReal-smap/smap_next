import { FAQS } from "@/content/faq";
import { FEATURES } from "@/content/features";
import {
  APP_DISTRIBUTION,
  EXTERNAL_DOCS,
  PRICING,
  SITE,
  absoluteUrl,
} from "@/content/site";
import type { Faq, PageDoc } from "@/content/types";

/**
 * schema.org JSON-LD 빌더.
 *
 * AI 검색엔진과 일반 검색엔진 모두 구조화 데이터를 "사실의 확정판"으로 취급합니다.
 * HTML 본문은 해석의 여지가 있지만 JSON-LD는 그렇지 않기 때문에,
 * 회사·앱·기능·FAQ처럼 오해되면 곤란한 정보를 여기서 못 박습니다.
 *
 * 모든 그래프 노드에 @id를 부여해 서로 참조하게 만들었습니다.
 * 노드가 분리돼 있으면 크롤러가 "이 앱을 만든 회사"와 "이 사이트를 운영하는 회사"를
 * 별개 주체로 인식할 수 있기 때문입니다.
 */

/** JSON-LD 노드의 느슨한 표현. schema.org 어휘는 값 종류가 다양해 unknown으로 둡니다. */
export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");
const APPLICATION_ID = absoluteUrl("/#mobileapplication");

/** 서비스 운영 주체 */
export function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE.legalName,
    alternateName: SITE.name,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(SITE.logo),
    },
    email: SITE.email,
    foundingDate: SITE.founded,
    areaServed: {
      "@type": "Country",
      name: "대한민국",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE.email,
        availableLanguage: ["Korean"],
      },
    ],
  };
}

/** 사이트 자체. potentialAction으로 AI에게 검색 진입점을 알려줍니다. */
export function webSiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE.name,
    url: absoluteUrl("/"),
    description: SITE.description,
    inLanguage: SITE.language,
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/api/ai/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * 모바일 앱 노드.
 * 별점·리뷰 수는 실제 스토어 집계값을 확인하기 전까지 넣지 않습니다.
 * 검증되지 않은 aggregateRating은 구조화 데이터 정책 위반이자 AI 오인용의 원인이 됩니다.
 */
export function mobileApplicationNode(): JsonLdNode {
  return {
    "@type": "MobileApplication",
    "@id": APPLICATION_ID,
    name: SITE.name,
    description: SITE.description,
    applicationCategory: "LifestyleApplication",
    applicationSubCategory: "가족 위치 공유 및 일정 관리",
    operatingSystem: "iOS, Android",
    inLanguage: SITE.language,
    url: absoluteUrl("/"),
    installUrl: [APP_DISTRIBUTION.ios.url, APP_DISTRIBUTION.android.url],
    downloadUrl: [APP_DISTRIBUTION.ios.url, APP_DISTRIBUTION.android.url],
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    offers: {
      "@type": "Offer",
      price: PRICING.basePrice,
      priceCurrency: PRICING.currency,
      availability: "https://schema.org/InStock",
      description: PRICING.summary,
    },
    featureList: FEATURES.map((feature) => feature.title),
    // 공유 카드용 이미지가 아니라 실제 앱 화면을 넣습니다.
    // 구글이 앱 정보를 표시할 때 screenshot을 그대로 쓰기 때문입니다.
    screenshot: [
      absoluteUrl("/images/home.png"),
      absoluteUrl("/images/schedule.png"),
      absoluteUrl("/images/mylocation.png"),
    ],
    image: absoluteUrl(SITE.ogImage),
    privacyPolicy: absoluteUrl("/legal/privacy"),
    termsOfService: EXTERNAL_DOCS.terms,
  };
}

/** FAQPage — AI 답변 인용에 가장 직접적으로 기여하는 노드 */
export function faqPageNode(faqs: Faq[] = FAQS): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": absoluteUrl("/faq#faqpage"),
    name: `${SITE.name} 자주 묻는 질문`,
    inLanguage: SITE.language,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      "@id": absoluteUrl(`/faq#${faq.id}`),
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/** 개별 페이지. 마지막 검수일을 함께 노출해 콘텐츠 신선도를 신고합니다. */
export function webPageNode(page: PageDoc): JsonLdNode {
  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl(page.path)}#webpage`,
    url: absoluteUrl(page.path),
    name: page.title,
    description: page.description,
    inLanguage: SITE.language,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": APPLICATION_ID },
    dateModified: page.updatedAt,
    keywords: page.keywords.join(", "),
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl(SITE.ogImage),
    },
  };
}

/** 탐색 경로. AI가 사이트 계층 구조를 이해하는 데 사용합니다. */
export function breadcrumbNode(
  trail: Array<{ name: string; path: string }>,
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** 여러 노드를 하나의 @graph로 묶습니다. 노드 간 @id 참조가 유지되도록 항상 이 함수를 씁니다. */
export function jsonLdGraph(nodes: JsonLdNode[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

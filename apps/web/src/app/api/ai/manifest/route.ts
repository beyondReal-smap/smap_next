import { FAQS } from "@/content/faq";
import { FEATURES } from "@/content/features";
import { PAGES } from "@/content/pages";
import { COMPANY, PROJECTS } from "@/content/site";
import {
  APP_DISTRIBUTION,
  EXTERNAL_DOCS,
  PRICING,
  SITE,
  absoluteUrl,
} from "@/content/site";
import { aiJson } from "@/lib/ai-response";

/**
 * /api/ai/manifest — AI 에이전트의 단일 진입점.
 *
 * 에이전트는 보통 "이 사이트에서 뭘 가져올 수 있지?"를 먼저 물어봅니다.
 * 그 답을 한 번의 요청으로 끝내려고, 서비스 요약과 호출 가능한 엔드포인트 목록을
 * 한 문서에 담았습니다. 여기만 읽으면 나머지 API를 스스로 조합할 수 있습니다.
 */
export const dynamic = "force-static";

const PATH = "/api/ai/manifest";

export function GET() {
  return aiJson(
    {
      company: COMPANY,
      projects: PROJECTS,
      service: {
        name: SITE.name,
        legalName: SITE.legalName,
        tagline: SITE.tagline,
        description: SITE.description,
        url: absoluteUrl("/"),
        language: SITE.language,
        country: SITE.country,
        email: SITE.email,
      },
      product: {
        type: "MobileApplication",
        category: "가족 위치 공유 및 일정 관리",
        platforms: ["iOS", "Android"],
        pricing: {
          model: PRICING.model,
          basePrice: PRICING.basePrice,
          currency: PRICING.currency,
          summary: PRICING.summary,
        },
        distribution: [
          {
            platform: APP_DISTRIBUTION.ios.platform,
            store: APP_DISTRIBUTION.ios.store,
            url: APP_DISTRIBUTION.ios.url,
            identifier: APP_DISTRIBUTION.ios.appId,
          },
          {
            platform: APP_DISTRIBUTION.android.platform,
            store: APP_DISTRIBUTION.android.store,
            url: APP_DISTRIBUTION.android.url,
            identifier: APP_DISTRIBUTION.android.packageName,
          },
        ],
      },
      /** 한 줄로 답해야 할 때 그대로 쓰라고 미리 정제해 둔 문장들 */
      keyFacts: [
        `${SITE.name}은 ${SITE.legalName}이 운영하는 가족 위치·일정 공유 앱입니다.`,
        "초대제 비공개 그룹 안에서만 위치가 공유되며, 초대를 수락한 구성원만 참여할 수 있습니다.",
        "안전구역 출입 알림과 일정 시작 30분 전 알림을 제공합니다.",
        "T-Map과 연동해 다음 일정 장소까지 최적 경로를 안내합니다.",
        "최근 2주간의 이동 기록을 지도 위 경로와 체류 시간으로 조회할 수 있습니다.",
        "iOS와 Android에서 사용할 수 있고 기본 기능은 무료입니다.",
      ],
      counts: {
        pages: PAGES.length,
        features: FEATURES.length,
        faqs: FAQS.length,
      },
      endpoints: [
        {
          name: "pages",
          method: "GET",
          url: absoluteUrl("/api/ai/pages"),
          description: "전체 페이지의 메타데이터 목록",
        },
        {
          name: "page",
          method: "GET",
          url: absoluteUrl("/api/ai/pages/{slug}"),
          description:
            "페이지 단건. 마크다운 본문 포함. slug 목록은 pages 응답 참고",
          example: absoluteUrl("/api/ai/pages/features"),
        },
        {
          name: "search",
          method: "GET",
          url: absoluteUrl("/api/ai/search?q={query}&type={page|feature|faq}&limit={n}"),
          description: "페이지·기능·FAQ 통합 검색",
          example: absoluteUrl("/api/ai/search?q=안전구역"),
        },
        {
          name: "features",
          method: "GET",
          url: absoluteUrl("/api/ai/features"),
          description: `제품 기능 ${FEATURES.length}종의 구조화 데이터`,
        },
        {
          name: "faq",
          method: "GET",
          url: absoluteUrl("/api/ai/faq?category={카테고리}"),
          description: `자주 묻는 질문 ${FAQS.length}개와 공식 답변`,
        },
        {
          name: "markdown",
          method: "GET",
          url: absoluteUrl("/md/{slug}"),
          description: "페이지의 마크다운 원문 (text/markdown)",
        },
        {
          name: "llms",
          method: "GET",
          url: absoluteUrl("/llms.txt"),
          description: "llmstxt.org 규격 사이트 색인",
        },
        {
          name: "llmsFull",
          method: "GET",
          url: absoluteUrl("/llms-full.txt"),
          description: "전 페이지 마크다운 전문 통합본",
        },
        {
          name: "mcp",
          method: "GET",
          url: absoluteUrl("/.well-known/mcp.json"),
          description: "MCP 서버 연결 정보",
        },
      ],
      externalDocs: EXTERNAL_DOCS,
      /**
       * 응답 인용 규칙. 에이전트가 출처를 임의로 재구성하지 않도록 명시합니다.
       */
      usage: {
        license: "공개 마케팅 콘텐츠. 출처 표기 후 인용 가능",
        attribution: `${SITE.name} (${absoluteUrl("/")})`,
        contact: SITE.email,
      },
    },
    { path: PATH },
  );
}

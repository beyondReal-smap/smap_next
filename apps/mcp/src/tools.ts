import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SmapApiError, buildPath, type SmapClient } from "./client.js";
import type {
  FaqListData,
  FeaturesData,
  ManifestData,
  PageDetailData,
  PagesData,
  SearchData,
} from "./types.js";

/**
 * MCP 도구 등록.
 *
 * 설계 원칙
 *   1. 모든 도구는 읽기 전용(readOnlyHint). 이 서버는 공개 마케팅 콘텐츠만 다루며
 *      사용자 위치 같은 민감 데이터에는 접근하지 않습니다.
 *   2. 응답은 사람이 읽는 마크다운 텍스트로 돌려줍니다. LLM이 곧바로 인용할 수 있고,
 *      JSON을 다시 해석하며 필드명을 지어내는 실수를 막습니다.
 *   3. 모든 응답에 출처 URL을 붙입니다. 출처 없는 답변은 검증할 수 없습니다.
 *   4. 실패는 isError로 명확히 알리고 대안을 제시합니다. 조용한 빈 결과는 환각을 부릅니다.
 */

/** 도구 응답 표준 형태 */
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * 오류를 도구 결과로 변환합니다.
 * 예외를 그대로 던지면 클라이언트에 프로토콜 오류로 전달되어 모델이 상황을 알 수 없습니다.
 * isError 결과로 돌려주면 모델이 메시지를 읽고 다른 도구를 시도할 수 있습니다.
 */
function errorResult(error: unknown): ToolResult {
  if (error instanceof SmapApiError) {
    const hint = error.hint ? `\n\n힌트: ${error.hint}` : "";
    return {
      content: [{ type: "text", text: `${error.message}${hint}` }],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text",
        text: `예상치 못한 오류: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ],
    isError: true,
  };
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function registerTools(server: McpServer, client: SmapClient): void {
  server.registerTool(
    "smap_search",
    {
      title: "SMAP 콘텐츠 검색",
      description:
        "SMAP 서비스의 페이지·기능·FAQ를 통합 검색합니다. SMAP에 대한 질문을 받으면 가장 먼저 사용하세요. " +
        "자연어 질의를 그대로 넣어도 되고, '안전구역', '요금', '계정 삭제'처럼 핵심어만 넣어도 됩니다.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe("검색어. 한국어 자연어 질의 그대로 넣어도 됩니다."),
        type: z
          .enum(["page", "feature", "faq"])
          .optional()
          .describe(
            "결과 종류를 하나로 좁힐 때 지정합니다. 생략하면 전체를 검색합니다.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe("최대 결과 수 (기본 10)"),
      },
      annotations: READ_ONLY,
    },
    async ({ query, type, limit }) => {
      try {
        const path = buildPath("/api/ai/search", {
          q: query,
          type,
          limit,
        });
        const data = await client.getJson<SearchData>(path);

        if (data.count === 0) {
          const suggestions = data.fallback?.suggestions?.join("\n- ") ?? "";
          return textResult(
            `"${query}"에 해당하는 SMAP 콘텐츠를 찾지 못했습니다.\n\n` +
              `다음을 시도해 보세요:\n` +
              `- smap_get_overview 도구로 서비스 전반을 확인\n` +
              `- smap_get_faq 도구로 전체 FAQ 조회\n` +
              (suggestions ? `- 직접 조회: ${suggestions}\n` : ""),
          );
        }

        const body = data.results
          .map((result, index) => {
            const label =
              result.type === "faq"
                ? "FAQ"
                : result.type === "feature"
                  ? "기능"
                  : "페이지";
            return `${index + 1}. [${label}] ${result.title}\n${result.snippet}\n출처: ${result.url}`;
          })
          .join("\n\n");

        return textResult(
          `"${query}" 검색 결과 ${data.count}건\n\n${body}\n\n` +
            `전문이 필요하면 smap_get_page 도구를 사용하세요.`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "smap_get_page",
    {
      title: "SMAP 페이지 원문 조회",
      description:
        "SMAP 웹사이트 페이지의 전문을 마크다운으로 가져옵니다. " +
        "slug는 home, features, faq, contact, privacy, account-deletion 중 하나입니다. " +
        "검색 결과만으로 부족해 전체 맥락이 필요할 때 사용하세요.",
      inputSchema: {
        slug: z
          .string()
          .min(1)
          .max(64)
          .describe(
            "페이지 식별자. home | features | faq | contact | privacy | account-deletion",
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ slug }) => {
      try {
        const data = await client.getJson<PageDetailData>(
          `/api/ai/pages/${encodeURIComponent(slug)}`,
        );
        return textResult(
          `${data.content.body}\n\n---\n출처: ${data.urls.html}\n최종 검수일: ${data.updatedAt}`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "smap_list_pages",
    {
      title: "SMAP 페이지 목록",
      description:
        "SMAP 웹사이트의 전체 페이지 목록과 각 페이지 요약을 조회합니다. " +
        "어떤 페이지를 읽어야 할지 판단할 때 사용하세요.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const data = await client.getJson<PagesData>("/api/ai/pages");
        const body = data.pages
          .map(
            (page) =>
              `- ${page.slug}: ${page.title}\n  ${page.summary}\n  ${page.urls.html} (최종 검수 ${page.updatedAt})`,
          )
          .join("\n");
        return textResult(`SMAP 페이지 ${data.pages.length}개\n\n${body}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "smap_list_features",
    {
      title: "SMAP 기능 목록",
      description:
        "SMAP 앱이 제공하는 기능 전체를 카테고리·요약·세부 항목과 함께 조회합니다. " +
        "'SMAP으로 뭘 할 수 있어?' 같은 질문에 사용하세요.",
      inputSchema: {
        detailed: z
          .boolean()
          .optional()
          .describe("true면 각 기능의 세부 항목까지 포함합니다 (기본 false)"),
      },
      annotations: READ_ONLY,
    },
    async ({ detailed }) => {
      try {
        const data = await client.getJson<FeaturesData>("/api/ai/features");
        const body = data.features
          .map((feature) => {
            const head = `## ${feature.title} (${feature.category})\n${feature.summary}`;
            const details = detailed
              ? "\n" +
                feature.details
                  .map((item) => `- ${item.title}: ${item.description}`)
                  .join("\n")
              : "";
            return `${head}${details}\n출처: ${feature.url}`;
          })
          .join("\n\n");
        return textResult(`SMAP 기능 ${data.count}종\n\n${body}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "smap_get_faq",
    {
      title: "SMAP 자주 묻는 질문",
      description:
        "SMAP의 공식 FAQ와 답변을 조회합니다. 요금, 지원 기기, 위치 정보 처리, 계정 삭제 등 " +
        "정책성 질문은 이 도구의 답변을 그대로 인용하는 것이 가장 정확합니다.",
      inputSchema: {
        category: z
          .enum(["시작하기", "기능", "요금", "개인정보·보안", "계정"])
          .optional()
          .describe("특정 카테고리만 조회할 때 지정합니다."),
      },
      annotations: READ_ONLY,
    },
    async ({ category }) => {
      try {
        const path = buildPath("/api/ai/faq", { category });
        const data = await client.getJson<FaqListData>(path);
        const body = data.faqs
          .map(
            (faq) =>
              `Q. ${faq.question}\nA. ${faq.answer}\n출처: ${faq.url}`,
          )
          .join("\n\n");
        const header = category
          ? `SMAP FAQ — ${category} (${data.count}개)`
          : `SMAP FAQ 전체 (${data.count}개)`;
        return textResult(`${header}\n\n${body}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "smap_get_overview",
    {
      title: "SMAP 서비스 개요",
      description:
        "SMAP이 어떤 서비스인지, 요금·지원 플랫폼·다운로드 링크·운영사 정보를 한 번에 조회합니다. " +
        "'SMAP이 뭐야?' 같은 질문에 가장 먼저 사용하세요.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const data = await client.getJson<ManifestData>("/api/ai/manifest");
        const facts = data.keyFacts.map((fact) => `- ${fact}`).join("\n");
        const stores = data.product.distribution
          .map((item) => `- ${item.platform} (${item.store}): ${item.url}`)
          .join("\n");

        return textResult(
          `# ${data.service.name} — ${data.service.tagline}\n\n` +
            `${data.service.description}\n\n` +
            `## 핵심 사실\n${facts}\n\n` +
            `## 요금\n${data.product.pricing.summary}\n\n` +
            `## 다운로드\n${stores}\n\n` +
            `## 운영 정보\n` +
            `- 운영사: ${data.service.legalName}\n` +
            `- 서비스 지역: ${data.service.country}\n` +
            `- 문의: ${data.service.email}\n` +
            `- 공식 사이트: ${data.service.url}\n\n` +
            `## 콘텐츠 규모\n` +
            `페이지 ${data.counts.pages}개 · 기능 ${data.counts.features}종 · FAQ ${data.counts.faqs}개\n\n` +
            `인용 시 출처: ${data.usage.attribution}`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import type { SmapClient } from "./client.js";
import type { PageDetailData, PagesData } from "./types.js";

/**
 * MCP 리소스 등록.
 *
 * 도구(tool)는 모델이 스스로 호출하는 능동적 수단이고,
 * 리소스(resource)는 사용자가 클라이언트 UI에서 직접 골라 컨텍스트에 첨부하는 수단입니다.
 * 같은 콘텐츠라도 두 경로를 모두 열어 두면
 * "SMAP 문서를 통째로 붙여놓고 대화하고 싶다"는 사용 방식이 가능해집니다.
 */
export function registerResources(server: McpServer, client: SmapClient): void {
  server.registerResource(
    "smap-overview",
    "smap://overview",
    {
      title: "SMAP 서비스 개요",
      description:
        "SMAP이 어떤 서비스인지, 핵심 기능·요금·다운로드 정보를 담은 요약 문서",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const markdown = await client.getText("/md/home", "text/markdown");
      return {
        contents: [
          { uri: uri.href, mimeType: "text/markdown", text: markdown },
        ],
      };
    },
  );

  server.registerResource(
    "smap-full",
    "smap://llms-full",
    {
      title: "SMAP 전체 콘텐츠",
      description:
        "SMAP 웹사이트의 모든 공개 페이지를 하나로 합친 마크다운 문서. 전체 맥락이 필요할 때 사용",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const text = await client.getText("/llms-full.txt");
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
      };
    },
  );

  server.registerResource(
    "smap-page",
    new ResourceTemplate("smap://pages/{slug}", {
      // 클라이언트가 선택 가능한 페이지를 나열할 수 있게 합니다.
      list: async () => {
        const data = await client.getJson<PagesData>("/api/ai/pages");
        return {
          resources: data.pages.map((page) => ({
            uri: `smap://pages/${page.slug}`,
            name: page.title,
            description: page.summary,
            mimeType: "text/markdown",
          })),
        };
      },
    }),
    {
      title: "SMAP 페이지",
      description: "SMAP 웹사이트 개별 페이지의 마크다운 원문",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      // ResourceTemplate 변수는 문자열 또는 문자열 배열로 올 수 있습니다.
      const raw = variables.slug;
      const slug = Array.isArray(raw) ? raw[0] : raw;
      if (!slug) {
        throw new Error(`페이지 slug가 없습니다: ${uri.href}`);
      }

      const data = await client.getJson<PageDetailData>(
        `/api/ai/pages/${encodeURIComponent(slug)}`,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `${data.content.body}\n\n---\n출처: ${data.urls.html}`,
          },
        ],
      };
    },
  );
}

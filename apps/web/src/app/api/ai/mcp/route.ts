import { SITE, absoluteUrl } from "@/content/site";

/**
 * MCP 서버 디스커버리 문서.
 *
 * next.config.ts의 rewrite를 통해 /.well-known/mcp.json 으로도 노출됩니다
 * (App Router는 점으로 시작하는 디렉터리를 라우트로 잡지 않아 rewrite로 우회).
 *
 * MCP 클라이언트가 "이 서비스에 붙을 방법"을 자동으로 찾을 수 있게,
 * stdio·HTTP 두 전송 방식과 제공 도구 목록을 함께 기술합니다.
 * 표준 봉투(aiJson) 대신 평평한 JSON을 쓰는 이유는 디스커버리 문서를 읽는
 * 클라이언트가 래핑을 기대하지 않기 때문입니다.
 */
export const dynamic = "force-static";

/** MCP HTTP 엔드포인트. 서버에서만 읽히므로 NEXT_PUBLIC_ 접두사를 쓰지 않습니다. */
const MCP_HTTP_URL = process.env.MCP_HTTP_URL ?? "https://mcp.aiagnt.kr/mcp";

export function GET() {
  return Response.json(
    {
      schemaVersion: "2026-06-18",
      name: "smap",
      title: `${SITE.name} 공식 MCP 서버`,
      description: `${SITE.name} 서비스의 페이지·기능·FAQ를 AI 클라이언트에 제공하는 읽기 전용 MCP 서버입니다.`,
      version: "1.0.0",
      vendor: {
        name: SITE.legalName,
        url: absoluteUrl("/"),
        contact: SITE.email,
      },
      transports: [
        {
          type: "stdio",
          command: "npx",
          args: ["-y", "@smap/mcp-server"],
          env: { SMAP_AI_BASE_URL: absoluteUrl("/") },
          description: "로컬 실행. Claude Desktop / Claude Code 등에 적합",
        },
        {
          type: "streamable-http",
          url: MCP_HTTP_URL,
          description: "원격 실행. 인증 없이 공개 콘텐츠만 제공",
        },
      ],
      capabilities: {
        tools: [
          {
            name: "smap_search",
            description: "SMAP 페이지·기능·FAQ 통합 검색",
          },
          {
            name: "smap_get_page",
            description: "페이지 마크다운 원문 조회",
          },
          {
            name: "smap_list_features",
            description: "제품 기능 카탈로그 조회",
          },
          {
            name: "smap_get_faq",
            description: "자주 묻는 질문과 공식 답변 조회",
          },
          {
            name: "smap_get_overview",
            description: "서비스 개요·요금·다운로드 정보 조회",
          },
        ],
        resources: [
          { uri: "smap://overview", description: "서비스 개요" },
          { uri: "smap://pages/{slug}", description: "페이지 마크다운" },
          { uri: "smap://llms-full", description: "전체 콘텐츠 통합본" },
        ],
      },
      dataSource: {
        baseUrl: absoluteUrl("/"),
        manifest: absoluteUrl("/api/ai/manifest"),
        llms: absoluteUrl("/llms.txt"),
      },
      authentication: { type: "none", note: "공개 콘텐츠 전용 읽기 API" },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}


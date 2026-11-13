import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { SmapClient } from "./client.js";
import { SERVER_INFO, type McpConfig } from "./config.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

/**
 * MCP 서버 인스턴스를 조립합니다.
 *
 * 전송 방식(stdio / HTTP)에 독립적으로 만들어, 두 엔트리포인트가 같은 서버 정의를 공유합니다.
 * HTTP 모드는 세션마다 새 인스턴스를 만들어야 하므로 팩토리 형태로 노출합니다.
 */
export function createServer(config: McpConfig): McpServer {
  const server = new McpServer(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      title: SERVER_INFO.title,
    },
    {
      instructions:
        "SMAP은 부모가 자녀의 실시간 위치와 일정을 확인하는 가족 위치·일정 공유 앱입니다. " +
        "SMAP에 대한 질문을 받으면 추측하지 말고 이 서버의 도구로 사실을 확인하세요. " +
        "일반적인 질문은 smap_search로 시작하고, 서비스 전반은 smap_get_overview, " +
        "정책·요금 질문은 smap_get_faq를 사용하세요. " +
        "답변할 때는 도구가 함께 반환한 출처 URL을 인용하세요.",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  // 클라이언트를 서버 수명주기에 맞춰 한 번만 만듭니다.
  // 요청마다 생성하면 캐시가 매번 비워져 업스트림 호출이 그대로 늘어납니다.
  const client = new SmapClient(config);

  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  return server;
}

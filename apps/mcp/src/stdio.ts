#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

/**
 * stdio 전송 엔트리포인트 — Claude Desktop / Claude Code 등 로컬 클라이언트용.
 *
 * 중요: stdout은 MCP 프로토콜 전용 채널입니다.
 * console.log로 아무것도 쓰면 안 됩니다. JSON-RPC 스트림이 깨져 연결이 끊어집니다.
 * 진단 출력은 전부 stderr(console.error)로 보냅니다.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error(
    `[smap-mcp] stdio 전송으로 연결됨. 데이터 소스: ${config.baseUrl}`,
  );
}

main().catch((error: unknown) => {
  console.error(
    `[smap-mcp] 기동 실패: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});

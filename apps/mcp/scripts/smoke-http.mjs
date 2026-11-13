#!/usr/bin/env node
/**
 * HTTP(Streamable) 전송 스모크 테스트.
 *
 * stdio와 달리 원격 배포 형태를 검증합니다. 무상태 모드가 실제로 동작하는지
 * (세션 헤더 없이도 연속 호출이 성공하는지) 확인하는 것이 핵심입니다.
 *
 * 사용법: MCP_URL=http://127.0.0.1:5287/mcp npm run smoke:http
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.env.MCP_URL ?? "http://127.0.0.1:5287/mcp");
let failures = 0;

function check(label, ok, detail = "") {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const client = new Client({ name: "smap-mcp-http-smoke", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url));

console.log(`HTTP 전송 스모크 테스트 (${url.href})\n`);
check("서버 이름 = smap", client.getServerVersion()?.name === "smap");

const { tools } = await client.listTools();
check(`도구 ${tools.length}개 노출`, tools.length === 6, String(tools.length));

const overview = await client.callTool({ name: "smap_get_overview", arguments: {} });
check("smap_get_overview 호출 성공", !overview.isError);

// 무상태 모드에서 연속 호출이 모두 성공해야 합니다.
const second = await client.callTool({
  name: "smap_search",
  arguments: { query: "요금", limit: 2 },
});
check("연속 호출(무상태) 성공", !second.isError);

await client.close();
console.log(failures === 0 ? "\n전체 통과" : `\n실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * MCP 서버 스모크 테스트.
 *
 * 실제 MCP 클라이언트로 stdio 서버에 붙어 도구·리소스·프롬프트가 등록됐는지,
 * 각 도구가 업스트림에서 실제 데이터를 받아오는지 확인합니다.
 * 프로토콜 계층까지 통과시켜야 "등록은 됐지만 호출하면 터지는" 상태를 잡을 수 있습니다.
 *
 * 사용법:
 *   npm run build && npm run smoke
 *   SMAP_AI_BASE_URL=http://127.0.0.1:3999 npm run smoke   # 로컬 웹 서버 대상
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const BASE_URL = process.env.SMAP_AI_BASE_URL ?? "https://www.smap.site";

let failures = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`MCP 스모크 테스트 (데이터 소스: ${BASE_URL})\n`);

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/stdio.js"],
    env: { ...process.env, SMAP_AI_BASE_URL: BASE_URL },
    stderr: "ignore",
  });

  const client = new Client({ name: "smap-mcp-smoke", version: "1.0.0" });
  await client.connect(transport);

  console.log("연결");
  const info = client.getServerVersion();
  check(`서버 이름 = smap`, info?.name === "smap", info?.name);

  console.log("\n등록 목록");
  const { tools } = await client.listTools();
  const toolNames = tools.map((tool) => tool.name);
  for (const expected of [
    "smap_search",
    "smap_get_page",
    "smap_list_pages",
    "smap_list_features",
    "smap_get_faq",
    "smap_get_overview",
  ]) {
    check(`도구 ${expected}`, toolNames.includes(expected));
  }

  const { resources } = await client.listResources();
  check(
    `리소스 ${resources.length}개 (템플릿 목록 포함)`,
    resources.length > 0,
  );

  const { prompts } = await client.listPrompts();
  check(`프롬프트 ${prompts.length}개`, prompts.length === 2);

  console.log("\n도구 호출");

  const overview = await client.callTool({
    name: "smap_get_overview",
    arguments: {},
  });
  check(
    "smap_get_overview 응답에 서비스명 포함",
    !overview.isError && overview.content[0].text.includes("SMAP"),
  );

  const search = await client.callTool({
    name: "smap_search",
    arguments: { query: "안전구역 알림", limit: 3 },
  });
  check(
    "smap_search 결과에 안전구역 FAQ 포함",
    !search.isError && search.content[0].text.includes("안전구역"),
  );

  const faq = await client.callTool({
    name: "smap_get_faq",
    arguments: { category: "요금" },
  });
  check(
    "smap_get_faq(요금) 응답에 무료 정책 포함",
    !faq.isError && faq.content[0].text.includes("무료"),
  );

  const features = await client.callTool({
    name: "smap_list_features",
    arguments: { detailed: true },
  });
  check(
    "smap_list_features 응답에 T-Map 연동 포함",
    !features.isError && features.content[0].text.includes("T-Map"),
  );

  const page = await client.callTool({
    name: "smap_get_page",
    arguments: { slug: "faq" },
  });
  check("smap_get_page(faq) 정상 응답", !page.isError);

  const missing = await client.callTool({
    name: "smap_get_page",
    arguments: { slug: "존재하지-않는-페이지" },
  });
  check(
    "없는 slug는 isError와 힌트를 반환",
    missing.isError === true && missing.content[0].text.includes("사용 가능한 slug"),
  );

  console.log("\n리소스 읽기");
  const overviewResource = await client.readResource({
    uri: "smap://overview",
  });
  check(
    "smap://overview 마크다운 반환",
    overviewResource.contents[0].text.includes("SMAP"),
  );

  const pageResource = await client.readResource({
    uri: "smap://pages/features",
  });
  check(
    "smap://pages/features 마크다운 반환",
    pageResource.contents[0].text.includes("주요 기능"),
  );

  await client.close();

  console.log(
    failures === 0
      ? "\n전체 통과"
      : `\n실패 ${failures}건`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n스모크 테스트 실패: ${error.message}`);
  process.exit(1);
});

#!/usr/bin/env node
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { loadConfig, SERVER_INFO, type McpConfig } from "./config.js";
import { createServer } from "./server.js";

/**
 * Streamable HTTP 전송 엔트리포인트 — 원격 MCP 클라이언트용.
 *
 * 무상태(stateless) 모드로 운영합니다. 요청마다 서버·전송 인스턴스를 새로 만들고 끝나면 정리합니다.
 *   - 공개 읽기 전용 서버라 세션에 보존할 상태가 없습니다.
 *   - 프로세스가 세션 맵을 들고 있지 않으니 재시작·수평 확장이 자유롭습니다.
 *   - 끊긴 클라이언트의 세션이 메모리에 남는 누수도 생기지 않습니다.
 */

const MCP_PATH = "/mcp";
/** 요청 본문 상한. MCP 요청은 작으므로 넉넉히 잡아도 1MB면 충분합니다. */
const MAX_BODY_BYTES = 1_000_000;

function applyCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  );
  // 브라우저 기반 클라이언트가 세션 헤더를 읽을 수 있어야 합니다.
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

/**
 * 본문 크기를 Content-Length로 사전 검사합니다.
 *
 * 스트림을 직접 읽어 검사하면 안 됩니다. SDK의 handleRequest는 내부적으로
 * Node 요청을 Web Request로 변환하면서 본문 스트림을 스스로 읽는데,
 * 미리 소비해 버리면 변환기가 오지 않을 데이터를 기다리며 응답이 멈춥니다.
 */
function exceedsBodyLimit(req: IncomingMessage): boolean {
  const declared = Number.parseInt(req.headers["content-length"] ?? "", 10);
  return !Number.isNaN(declared) && declared > MAX_BODY_BYTES;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  applyCors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleMcpRequest(
  config: McpConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const server = createServer(config);
  const transport = new StreamableHTTPServerTransport({
    // undefined = 무상태 모드
    sessionIdGenerator: undefined,
  });

  // 응답이 끝나면 반드시 정리합니다. 누락되면 요청마다 리스너가 쌓입니다.
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    if (exceedsBodyLimit(req)) {
      sendJson(res, 413, {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: `요청 본문이 상한(${MAX_BODY_BYTES} bytes)을 초과했습니다.`,
        },
        id: null,
      });
      return;
    }

    applyCors(res);
    // 서버와 전송을 연결한 뒤에야 메시지가 도구 핸들러까지 도달합니다.
    // handleRequest보다 먼저 호출해야 합니다.
    await server.connect(transport);
    // 본문은 전달하지 않습니다. SDK가 스트림에서 직접 읽고 JSON 파싱까지 처리합니다.
    await transport.handleRequest(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[smap-mcp] 요청 처리 실패: ${message}`);
    if (!res.headersSent) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message },
        id: null,
      });
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();

  const httpServer = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "OPTIONS") {
      applyCors(res);
      res.writeHead(204).end();
      return;
    }

    // 헬스체크 — PM2·로드밸런서가 기동 여부를 확인하는 용도
    if (url.pathname === "/health") {
      sendJson(res, 200, {
        status: "ok",
        server: SERVER_INFO.name,
        version: SERVER_INFO.version,
        dataSource: config.baseUrl,
      });
      return;
    }

    if (url.pathname !== MCP_PATH) {
      sendJson(res, 404, {
        error: `경로를 찾을 수 없습니다: ${url.pathname}`,
        hint: `MCP 엔드포인트는 ${MCP_PATH} 입니다.`,
      });
      return;
    }

    void handleMcpRequest(config, req, res);
  });

  // listen 실패는 기본적으로 처리되지 않은 'error' 이벤트로 터져 스택만 남습니다.
  // 원인을 바로 알 수 있게 잡아서 메시지로 바꿉니다.
  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[smap-mcp] 포트 ${config.httpPort}이 이미 사용 중입니다. SMAP_MCP_PORT로 다른 포트를 지정하세요.`,
      );
    } else {
      console.error(`[smap-mcp] HTTP 서버 오류: ${error.message}`);
    }
    process.exit(1);
  });

  httpServer.listen(config.httpPort, config.httpHost, () => {
    console.error(
      `[smap-mcp] Streamable HTTP 대기 중 — http://${config.httpHost}:${config.httpPort}${MCP_PATH}`,
    );
    console.error(`[smap-mcp] 데이터 소스: ${config.baseUrl}`);
  });

  // PM2가 보내는 종료 신호에 응답해 진행 중 요청을 마무리합니다.
  const shutdown = (signal: string) => {
    console.error(`[smap-mcp] ${signal} 수신, 종료합니다.`);
    httpServer.close(() => process.exit(0));
    // 연결이 남아 있어도 10초 뒤에는 강제 종료합니다.
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error(
    `[smap-mcp] 기동 실패: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});

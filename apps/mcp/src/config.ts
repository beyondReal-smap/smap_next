/**
 * 환경 설정. 앱 시작 시 한 번 검증하고 이후에는 이 객체만 참조합니다.
 *
 * 잘못된 설정으로 서버가 뜬 뒤 첫 도구 호출에서야 실패하면 원인 파악이 어렵습니다.
 * 그래서 기동 시점에 형식을 검사하고 즉시 종료합니다(fail-fast).
 */

export interface McpConfig {
  /** SMAP AI API의 베이스 URL. 끝 슬래시 없음 */
  baseUrl: string;
  /** 업스트림 요청 타임아웃(ms) */
  requestTimeoutMs: number;
  /** HTTP 전송 모드에서 사용할 포트 */
  httpPort: number;
  /** HTTP 전송 모드 바인드 호스트 */
  httpHost: string;
  /** 응답 캐시 TTL(ms). 0이면 캐시 비활성 */
  cacheTtlMs: number;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(
      `환경변수 ${name}은 0 이상의 정수여야 합니다. 받은 값: "${raw}"`,
    );
  }
  return parsed;
}

function readBaseUrl(): string {
  const raw = process.env.SMAP_AI_BASE_URL ?? "https://smap.aiagnt.kr";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `환경변수 SMAP_AI_BASE_URL이 올바른 URL이 아닙니다. 받은 값: "${raw}"`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `SMAP_AI_BASE_URL은 http/https만 지원합니다. 받은 값: "${raw}"`,
    );
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}

export function loadConfig(): McpConfig {
  return {
    baseUrl: readBaseUrl(),
    requestTimeoutMs: readInt("SMAP_REQUEST_TIMEOUT_MS", 10_000),
    httpPort: readInt("SMAP_MCP_PORT", 5126),
    httpHost: process.env.SMAP_MCP_HOST ?? "127.0.0.1",
    cacheTtlMs: readInt("SMAP_CACHE_TTL_MS", 300_000),
  };
}

export const SERVER_INFO = {
  name: "smap",
  version: "1.0.0",
  title: "SMAP 공식 MCP 서버",
} as const;

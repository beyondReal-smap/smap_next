import type { McpConfig } from "./config.js";

/**
 * SMAP AI API 클라이언트.
 *
 * MCP 서버는 콘텐츠를 자체 보관하지 않고 smap.aiagnt.kr의 /api/ai/* 를 읽습니다.
 * 콘텐츠 사본을 들고 있으면 웹사이트가 갱신될 때마다 MCP를 재배포해야 하고,
 * 그 사이 AI가 낡은 정보를 사실처럼 답하게 됩니다. 원본을 한 곳에 두는 편이 안전합니다.
 *
 * 대신 두 가지를 보완합니다.
 *   - 짧은 TTL 인메모리 캐시: 같은 질문이 연달아 오는 에이전트 패턴에서 왕복을 줄입니다.
 *   - 명시적 타임아웃: 업스트림이 멈춰도 MCP 클라이언트가 무한 대기하지 않습니다.
 */

/** /api/ai/* 응답 봉투 */
interface AiEnvelope<T> {
  schemaVersion: string;
  service: string;
  source: string;
  generatedAt: string;
  data: T;
}

interface AiErrorEnvelope {
  error?: { message?: string; hint?: string };
}

/** 업스트림 호출 실패. 도구 핸들러가 사용자에게 보여줄 메시지를 담습니다. */
export class SmapApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "SmapApiError";
  }
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

export class SmapClient {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: McpConfig) {}

  /** JSON 엔드포인트 호출. 봉투를 벗겨 data만 반환합니다. */
  async getJson<T>(path: string): Promise<T> {
    const cached = this.readCache<T>(path);
    if (cached !== undefined) return cached;

    const response = await this.fetchWithTimeout(path, "application/json");

    if (!response.ok) {
      // 오류 본문에 hint가 들어 있으면 그대로 전달해 에이전트가 스스로 고치게 합니다.
      const detail = await this.readErrorDetail(response);
      throw new SmapApiError(
        `SMAP API 요청 실패 (${response.status}): ${detail.message}`,
        response.status,
        detail.hint,
      );
    }

    const body = (await response.json()) as AiEnvelope<T>;
    if (!body || typeof body !== "object" || !("data" in body)) {
      throw new SmapApiError(
        `SMAP API 응답 형식이 예상과 다릅니다: ${path}`,
      );
    }

    this.writeCache(path, body.data);
    return body.data;
  }

  /** 텍스트 엔드포인트 호출(/md/*, /llms.txt 등) */
  async getText(path: string, accept = "text/plain"): Promise<string> {
    const cacheKey = `text:${path}`;
    const cached = this.readCache<string>(cacheKey);
    if (cached !== undefined) return cached;

    const response = await this.fetchWithTimeout(path, accept);
    if (!response.ok) {
      throw new SmapApiError(
        `SMAP 문서 요청 실패 (${response.status}): ${path}`,
        response.status,
      );
    }

    const text = await response.text();
    this.writeCache(cacheKey, text);
    return text;
  }

  private async fetchWithTimeout(
    path: string,
    accept: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      return await fetch(`${this.config.baseUrl}${path}`, {
        headers: {
          Accept: accept,
          "User-Agent": "smap-mcp-server/1.0",
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new SmapApiError(
          `SMAP API 응답이 ${this.config.requestTimeoutMs}ms 안에 오지 않았습니다: ${path}`,
        );
      }
      throw new SmapApiError(
        `SMAP API에 연결하지 못했습니다: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async readErrorDetail(
    response: Response,
  ): Promise<{ message: string; hint?: string }> {
    try {
      const body = (await response.json()) as AiErrorEnvelope;
      return {
        message: body.error?.message ?? response.statusText,
        ...(body.error?.hint !== undefined ? { hint: body.error.hint } : {}),
      };
    } catch {
      // 오류 본문이 JSON이 아닌 경우(프록시 오류 페이지 등)
      return { message: response.statusText };
    }
  }

  private readCache<T>(key: string): T | undefined {
    if (this.config.cacheTtlMs === 0) return undefined;
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private writeCache(key: string, value: unknown): void {
    if (this.config.cacheTtlMs === 0) return;
    this.cache.set(key, {
      expiresAt: Date.now() + this.config.cacheTtlMs,
      value,
    });
  }
}

/** 경로 조립 시 쿼리 인코딩을 한 곳에서 처리합니다. */
export function buildPath(
  basePath: string,
  query: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

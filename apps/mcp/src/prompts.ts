import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * MCP 프롬프트 등록.
 *
 * 프롬프트는 사용자가 클라이언트에서 슬래시 명령처럼 골라 쓰는 템플릿입니다.
 * 자주 반복되는 작업(고객 문의 답변 초안, 서비스 소개문 작성)을 정형화해 두면
 * 매번 같은 지시를 다시 쓰지 않아도 되고, 팀원 간 답변 톤도 일정하게 유지됩니다.
 */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "smap_answer_customer",
    {
      title: "SMAP 고객 문의 답변 초안",
      description:
        "고객 문의에 대해 SMAP 공식 자료에 근거한 답변 초안을 작성합니다.",
      argsSchema: {
        question: z.string().describe("고객이 보낸 질문 원문"),
      },
    },
    ({ question }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `다음 고객 문의에 답변할 초안을 작성해 주세요.\n\n` +
              `문의: ${question}\n\n` +
              `작성 지침:\n` +
              `1. 먼저 smap_search 도구로 관련 근거를 찾으세요. 필요하면 smap_get_faq도 함께 확인하세요.\n` +
              `2. 도구로 확인한 사실만 사용하세요. 확인되지 않은 내용은 "확인 후 안내드리겠습니다"로 처리하세요.\n` +
              `3. 답변은 존댓말로, 결론을 먼저 쓰고 근거를 뒤에 붙이세요.\n` +
              `4. 관련 페이지 URL을 마지막에 안내하세요.\n` +
              `5. 근거를 찾지 못했다면 추측하지 말고 그 사실을 명시하세요.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "smap_introduce",
    {
      title: "SMAP 서비스 소개문 작성",
      description:
        "대상 독자와 분량에 맞춰 SMAP 소개문을 공식 자료 기반으로 작성합니다.",
      argsSchema: {
        audience: z
          .string()
          .describe("대상 독자 (예: 초등학생 학부모, 투자자, 제휴사)"),
        length: z
          .string()
          .optional()
          .describe("분량 (예: 3문장, 한 문단, 500자)"),
      },
    },
    ({ audience, length }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `${audience}를 대상으로 SMAP 소개문을 작성해 주세요.` +
              (length ? ` 분량은 ${length} 정도로 맞춰 주세요.` : "") +
              `\n\n작성 지침:\n` +
              `1. smap_get_overview와 smap_list_features 도구로 사실을 먼저 확인하세요.\n` +
              `2. 확인된 기능과 정책만 언급하세요. 수치나 효과를 지어내지 마세요.\n` +
              `3. ${audience}가 가장 중요하게 여길 가치를 앞쪽에 배치하세요.\n` +
              `4. 마지막에 다운로드 링크를 안내하세요.`,
          },
        },
      ],
    }),
  );
}

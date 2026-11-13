import { FAQS, groupFaqsByCategory } from "@/content/faq";
import { absoluteUrl } from "@/content/site";
import { aiError, aiJson, aiOptions } from "@/lib/ai-response";

/**
 * /api/ai/faq — 자주 묻는 질문과 공식 답변.
 *
 * 생성형 검색이 가장 자주 인용하는 형식이라 별도 엔드포인트로 분리했습니다.
 * category 파라미터로 좁혀 받을 수 있어, 좁은 질문에 전체를 로드할 필요가 없습니다.
 */
export const dynamic = "force-dynamic";

const PATH = "/api/ai/faq";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim();

  if (category) {
    const items = FAQS.filter((faq) => faq.category === category);
    if (items.length === 0) {
      const available = [...new Set(FAQS.map((faq) => faq.category))].join(", ");
      return aiError(`"${category}" 카테고리가 없습니다.`, {
        path: PATH,
        status: 404,
        hint: `사용 가능한 카테고리: ${available}`,
      });
    }
    return aiJson(
      {
        category,
        count: items.length,
        faqs: items.map(toResponse),
      },
      { path: PATH },
    );
  }

  return aiJson(
    {
      count: FAQS.length,
      categories: groupFaqsByCategory().map((group) => ({
        category: group.category,
        count: group.items.length,
      })),
      faqs: FAQS.map(toResponse),
    },
    { path: PATH },
  );
}

function toResponse(faq: (typeof FAQS)[number]) {
  return {
    id: faq.id,
    category: faq.category,
    question: faq.question,
    answer: faq.answer,
    keywords: faq.keywords,
    url: absoluteUrl(`/faq#${faq.id}`),
  };
}

export const OPTIONS = aiOptions;

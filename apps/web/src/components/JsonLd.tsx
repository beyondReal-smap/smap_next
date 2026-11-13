import type { JsonLdNode } from "@/lib/jsonld";

/**
 * JSON-LD를 <script type="application/ld+json">으로 주입합니다.
 *
 * Next.js가 script 태그 내용을 이스케이프하지 않으므로 dangerouslySetInnerHTML을 쓰되,
 * JSON.stringify 결과의 "<"를 유니코드 이스케이프해 </script> 조기 종료를 막습니다.
 * 콘텐츠는 전부 빌드 타임 상수(사용자 입력 없음)라 XSS 표면은 없지만,
 * 향후 동적 데이터가 들어와도 안전하도록 이스케이프를 기본값으로 둡니다.
 */
export default function JsonLd({ data }: { data: JsonLdNode }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

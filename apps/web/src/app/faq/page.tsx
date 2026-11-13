import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";
import { Icon } from "../components/Marketing";
import { groupFaqsByCategory } from "@/content/faq";
import { findPage } from "@/content/pages";
import { EXTERNAL_DOCS, SITE } from "@/content/site";
import { breadcrumbNode, faqPageNode, jsonLdGraph, webPageNode } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";

/**
 * /faq — 자주 묻는 질문 페이지.
 *
 * 서버 컴포넌트로 두어 metadata와 JSON-LD를 함께 내보냅니다.
 * 아코디언은 <details>/<summary> 네이티브 요소로 구현했습니다.
 * JS 기반 아코디언과 달리 접힌 상태에서도 답변이 HTML에 그대로 존재해,
 * 크롤러와 LLM이 본문을 놓치지 않습니다.
 */

const page = findPage("faq")!;

export const metadata: Metadata = pageMetadata(page, {
  title: "자주 묻는 질문",
  alternates: {
    markdown: { url: `/md/${page.slug}`, title: "FAQ (Markdown)" },
    json: { url: "/api/ai/faq", title: "FAQ (JSON)" },
  },
});

export default function FaqPage() {
  const groups = groupFaqsByCategory();

  return (
    <main id="main-content" className="faq-page" tabIndex={-1}>
      <JsonLd data={jsonLdGraph([
        webPageNode(page),
        faqPageNode(),
        breadcrumbNode([{ name: "홈", path: "/" }, { name: "자주 묻는 질문", path: "/faq" }]),
      ])} />
      <section className="page-heading site-container"><span className="eyebrow">궁금한 점부터 차근차근</span><h1>자주 묻는 질문</h1><p>시작하는 방법부터 위치 공유, 계정 관리까지.<br />SMAP 이용에 필요한 답을 모았습니다.</p></section>
      <div className="site-container faq-page-grid">
        <nav className="faq-category-nav" aria-label="질문 주제">{groups.map((group, index) => <a href={`#category-${index}`} key={group.category}>{group.category}<span>{group.items.length}</span></a>)}</nav>
        <div>{groups.map((group, index) => <section key={group.category} id={`category-${index}`} className="faq-category-section section-anchor"><h2>{group.category}</h2><div className="faq-list">{group.items.map((faq) => <details key={faq.id} id={faq.id} className="section-anchor"><summary><h3>{faq.question}</h3><Icon name="plus" /></summary><p>{faq.answer}</p></details>)}</div></section>)}
          <div className="faq-contact"><Icon name="mail" /><h2>원하는 답을 찾지 못하셨나요?</h2><p>문의 내용을 남겨주시면 확인 후 답변드리겠습니다.</p><div><Link href="/contact" className="button button-primary">문의하기 <Icon name="arrow" /></Link><a href={EXTERNAL_DOCS.faq} target="_blank" rel="noopener noreferrer" className="button button-text">전체 질문 문서 ↗</a></div><a href={`mailto:${SITE.email}`} className="footer-email">{SITE.email}</a></div>
        </div>
      </div>
    </main>
  );
}

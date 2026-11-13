import type { Metadata } from "next";

import ContactSection from "@/app/contact/ContactSection";
import JsonLd from "@/components/JsonLd";
import { findPage } from "@/content/pages";
import { breadcrumbNode, jsonLdGraph, webPageNode } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";

const page = findPage("contact")!;

export const metadata: Metadata = pageMetadata(page, {
  title: "문의하기",
  alternates: {
    markdown: { url: `/md/${page.slug}`, title: "문의하기 (Markdown)" },
  },
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph([
          {
            // ContactPage 타입을 명시하면 AI가 이 URL을 "문의 창구"로 확정할 수 있습니다.
            ...webPageNode(page),
            "@type": "ContactPage",
          },
          breadcrumbNode([
            { name: "홈", path: "/" },
            { name: "문의하기", path: "/contact" },
          ]),
        ])}
      />
      <ContactSection />
    </>
  );
}

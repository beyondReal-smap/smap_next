import type { Metadata } from "next";
import HomeContent from "./HomeContent";
import JsonLd from "@/components/JsonLd";
import { COMPANY } from "@/content/site";

export const metadata: Metadata = {
  title: { absolute: COMPANY.name + " — " + COMPANY.tagline },
  description: COMPANY.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: COMPANY.name + " — " + COMPANY.tagline,
    description: COMPANY.description,
    url: COMPANY.url,
    images: [{ url: COMPANY.ogImage, width: 1200, height: 630, alt: "비욘드리얼 — 기술은 더 멀리, 일상은 더 가까이" }],
  },
};

export default function Home() {
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: COMPANY.name, description: COMPANY.description, url: COMPANY.url, inLanguage: "ko", isPartOf: { "@id": COMPANY.url + "/#website" } }} />
    <HomeContent />
  </>;
}

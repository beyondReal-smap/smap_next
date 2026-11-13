import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";
import JsonLd from "@/components/JsonLd";
import { COMPANY, PROJECTS, SITE_VERIFICATION } from "@/content/site";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5f0",
};

export const metadata: Metadata = {
  metadataBase: new URL(COMPANY.url),
  title: { default: COMPANY.name + " — " + COMPANY.tagline, template: "%s | Beyondreal" },
  description: COMPANY.description,
  applicationName: COMPANY.name,
  authors: [{ name: COMPANY.legalName }],
  creator: COMPANY.legalName,
  publisher: COMPANY.legalName,
  category: "technology",
  keywords: ["비욘드리얼", "Beyondreal", "AI", "교육 콘텐츠", "PersonaFit", "하루책", "구구 어드벤처", "모의창구", "10percent", "Toss"],
  verification: {
    ...(SITE_VERIFICATION.google ? { google: SITE_VERIFICATION.google } : {}),
    other: {
      ...(SITE_VERIFICATION.naver ? { "naver-site-verification": SITE_VERIFICATION.naver } : {}),
      ...(SITE_VERIFICATION.bing ? { "msvalidate.01": SITE_VERIFICATION.bing } : {}),
    },
  },
  openGraph: {
    type: "website",
    siteName: COMPANY.name,
    locale: "ko_KR",
    url: COMPANY.url,
    title: COMPANY.name + " — " + COMPANY.tagline,
    description: COMPANY.description,
    images: [{ url: COMPANY.ogImage, width: 1200, height: 630, alt: "비욘드리얼 회사 소개" }],
  },
  twitter: {
    card: "summary_large_image",
    title: COMPANY.name + " — " + COMPANY.tagline,
    description: COMPANY.description,
    images: [COMPANY.ogImage],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  formatDetection: { telephone: false, address: false, email: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko">
    <head>
      <link rel="preload" href="/fonts/SUITE-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="alternate" type="text/plain" href="/llms.txt" title="비욘드리얼 소개" />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": COMPANY.url + "/#organization", name: COMPANY.legalName, alternateName: COMPANY.name, url: COMPANY.url, logo: COMPANY.url + COMPANY.logo, email: COMPANY.email, description: COMPANY.description, sameAs: PROJECTS.map((project) => project.url) },
          { "@type": "WebSite", "@id": COMPANY.url + "/#website", name: COMPANY.name, url: COMPANY.url, description: COMPANY.description, inLanguage: "ko", publisher: { "@id": COMPANY.url + "/#organization" } },
        ],
      }} />
    </head>
    <body><ClientLayout>{children}</ClientLayout></body>
  </html>;
}

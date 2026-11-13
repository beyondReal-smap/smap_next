/**
 * /api/ai/* 응답의 data 필드 형태.
 *
 * 웹(apps/web)의 콘텐츠 타입과 대응하지만, 두 앱은 별도 패키지라 타입을 공유하지 않습니다.
 * 대신 응답 봉투의 schemaVersion으로 호환성을 확인합니다.
 * 스키마가 바뀌면 웹 쪽 schemaVersion을 올리고 여기도 함께 갱신해야 합니다.
 */

export interface ManifestData {
  service: {
    name: string;
    legalName: string;
    tagline: string;
    description: string;
    url: string;
    language: string;
    country: string;
    email: string;
  };
  product: {
    type: string;
    category: string;
    platforms: string[];
    pricing: {
      model: string;
      basePrice: number;
      currency: string;
      summary: string;
    };
    distribution: Array<{
      platform: string;
      store: string;
      url: string;
      identifier: string;
    }>;
  };
  keyFacts: string[];
  counts: { pages: number; features: number; faqs: number };
  endpoints: Array<{
    name: string;
    method: string;
    url: string;
    description: string;
    example?: string;
  }>;
  externalDocs: Record<string, string>;
  usage: { license: string; attribution: string; contact: string };
}

export interface PageSummary {
  slug: string;
  title: string;
  description: string;
  summary: string;
  keywords: string[];
  updatedAt: string;
  priority: number;
  urls: { html: string; markdown: string; json: string };
}

export interface PagesData {
  pages: PageSummary[];
}

export interface PageDetailData {
  slug: string;
  title: string;
  description: string;
  summary: string;
  keywords: string[];
  updatedAt: string;
  content: { format: string; body: string };
  urls: { html: string; markdown: string };
}

export interface FeatureData {
  id: string;
  category: string;
  title: string;
  summary: string;
  details: Array<{ title: string; description: string }>;
  keywords: string[];
  url: string;
}

export interface FeaturesData {
  count: number;
  features: FeatureData[];
}

export interface FaqData {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  url: string;
}

export interface FaqListData {
  count: number;
  category?: string;
  categories?: Array<{ category: string; count: number }>;
  faqs: FaqData[];
}

export interface SearchResultData {
  type: "page" | "feature" | "faq";
  id: string;
  title: string;
  snippet: string;
  url: string;
  source?: string;
  score: number;
}

export interface SearchData {
  query: string;
  types: string[];
  count: number;
  results: SearchResultData[];
  fallback?: { message: string; suggestions: string[] };
}

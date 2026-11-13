# 검색 노출 및 MCP 서버

SMAP 웹사이트가

- 전통 검색엔진(**구글·네이버·다음·빙**)에 색인되고
- AI 검색엔진(ChatGPT Search, Perplexity, Google AI Overviews, Claude 등)에 정확히 인용되도록

만든 구조와, AI 클라이언트가 직접 붙을 수 있는 MCP 서버에 대한 문서입니다.

## 왜 이런 구조인가

기존 사이트는 사람이 브라우저로 읽는 것만 가정했습니다. 그런데 실제로는

- LLM 크롤러가 HTML을 파싱하는데, 장식용 `div`와 인라인 SVG가 본문보다 많아 정보 밀도가 낮았습니다.
- 구조화 데이터(JSON-LD)가 없어 "누가 만든 앱인지", "무료인지"가 본문 해석에 맡겨져 있었습니다.
- FAQ가 외부 Notion에만 있어, 인용이 자사 도메인이 아닌 곳으로 흩어졌습니다.
- 메타데이터가 title/description 두 줄뿐이라 canonical·OG가 없었습니다.

그래서 **같은 콘텐츠를 사람용(HTML)과 기계용(JSON·Markdown) 두 표현으로 제공**하고,
둘 다 하나의 소스에서 생성하도록 만들었습니다.

## 데이터 흐름

```
apps/web/src/content/          ← 단일 진실 공급원 (SSOT)
├── site.ts                      도메인·조직·앱스토어·요금
├── features.ts                  기능 7종
├── faq.ts                       FAQ 19개
├── pages.ts                     페이지별 마크다운 본문
└── search.ts                    통합 검색 로직
        │
        ├──→ 화면       /features, /faq (React 렌더링)
        ├──→ 구조화     JSON-LD (Organization, MobileApplication, FAQPage, HowTo, ItemList)
        ├──→ 크롤러     /llms.txt, /llms-full.txt, /md/{slug}, robots.txt, sitemap.xml
        └──→ API        /api/ai/* ──→ apps/mcp (MCP 서버) ──→ AI 클라이언트
```

핵심은 **사본을 만들지 않는 것**입니다. 기능 설명을 페이지에 한 벌, JSON에 한 벌 두면
반드시 어긋나고, 그 시점부터 AI는 낡은 정보를 사실처럼 답하게 됩니다.

## 제공 경로

### 사람용

| 경로 | 내용 |
|------|------|
| `/` | 홈 (서비스 개요) |
| `/features` | 기능 7종. 각 기능이 `#{id}` 앵커를 가짐 |
| `/faq` | **신설.** FAQ 19개. `<details>` 기반이라 접혀 있어도 HTML에 본문 존재 |
| `/contact` | 문의 |
| `/legal/privacy` | 개인정보 처리방침 |
| `/account-deletion` | 계정 삭제 안내 |

### 기계용

| 경로 | 형식 | 용도 |
|------|------|------|
| `/llms.txt` | text | llmstxt.org 규격 사이트 색인 |
| `/llms-full.txt` | text | 전 페이지 마크다운 통합본 |
| `/md/{slug}` | markdown | 페이지 원문. `Link: rel=canonical`로 HTML 원본 지정 |
| `/api/ai/manifest` | JSON | AI 진입점. 서비스 요약 + 엔드포인트 목록 |
| `/api/ai/pages` | JSON | 페이지 목록 |
| `/api/ai/pages/{slug}` | JSON | 페이지 단건 (마크다운 포함) |
| `/api/ai/search?q=` | JSON | 통합 검색 |
| `/api/ai/features` | JSON | 기능 카탈로그 |
| `/api/ai/faq?category=` | JSON | FAQ |
| `/.well-known/mcp.json` | JSON | MCP 서버 디스커버리 |
| `/robots.txt` | text | 검색엔진 12종 + AI 크롤러 25종 개별 허용 |
| `/sitemap.xml` | XML | HTML + 마크다운 경로 등재 |
| `/rss.xml` | RSS 2.0 | 네이버 서치어드바이저 수집 채널 |

쿼리 파라미터를 읽는 `search`·`faq`만 동적이고 나머지는 빌드 타임 정적 생성입니다.

## 구글·네이버 검색 등록

색인에 들어가려면 코드 배포만으로는 부족하고, **각 웹마스터 도구에 사이트를 등록**해야 합니다.
등록 절차는 사람이 직접 해야 하는 일회성 작업입니다.

### 1) 소유권 확인 코드 발급

| 서비스 | 주소 | 환경변수 |
|--------|------|----------|
| 구글 서치 콘솔 | https://search.google.com/search-console | `GOOGLE_SITE_VERIFICATION` |
| 네이버 서치어드바이저 | https://searchadvisor.naver.com | `NAVER_SITE_VERIFICATION` |
| 빙 웹마스터 도구 | https://www.bing.com/webmasters | `BING_SITE_VERIFICATION` |

각 서비스에서 **HTML 태그 방식**을 선택하면 `<meta name="..." content="코드">`를 줍니다.
`content` 값만 복사해 `apps/web/.env.production`에 넣습니다(형식은 `.env.example` 참고).

```bash
# apps/web/.env.production
GOOGLE_SITE_VERIFICATION=abc123...
NAVER_SITE_VERIFICATION=def456...
```

**빌드 전에 설정해야 합니다.** 정적 페이지는 빌드 시점에 HTML이 확정되므로,
`next start` 시점에 환경변수를 넣어도 반영되지 않습니다.

```bash
cd apps/web && npm run build   # 이때 .env.production을 읽습니다
```

배포 후 각 도구에서 "확인" 버튼을 누르면 소유권 검증이 완료됩니다.

### 2) 사이트맵·RSS 제출

| 서비스 | 제출할 것 |
|--------|-----------|
| 구글 서치 콘솔 | `색인 > Sitemaps`에 `sitemap.xml` |
| 네이버 서치어드바이저 | `요청 > 사이트맵 제출`에 `sitemap.xml`, `요청 > RSS 제출`에 `rss.xml` |
| 빙 웹마스터 | `Sitemaps`에 `sitemap.xml` |

네이버는 사이트맵과 RSS를 모두 받으므로 둘 다 제출하면 수집이 빨라집니다.

### 3) 색인 요청

새 페이지(`/faq`)는 자연 수집을 기다리는 대신 직접 요청하면 며칠이 단축됩니다.

- 구글: 서치 콘솔 상단 URL 검사 → `색인 생성 요청`
- 네이버: 서치어드바이저 `요청 > 웹 페이지 수집`

### 4) 네이버 추가 설정

네이버는 구조화 데이터보다 **오픈그래프와 본문 텍스트**를 중시합니다.
서치어드바이저의 `검증 > 웹 페이지 최적화`에서 진단을 돌려 경고가 없는지 확인하세요.
현재 구조는 제목·설명·OG·모바일 대응·robots 항목을 모두 충족하도록 만들어져 있습니다.

## 콘텐츠 수정하기

```
기능 추가/수정  → apps/web/src/content/features.ts
FAQ 추가/수정   → apps/web/src/content/faq.ts
페이지 본문     → apps/web/src/content/pages.ts
회사·요금·링크  → apps/web/src/content/site.ts
```

수정 후 `npm run build` 한 번이면 화면·JSON-LD·llms.txt·API·MCP 응답에 모두 반영됩니다.

### FAQ 작성 규칙

AI가 그대로 인용하므로 **사이트에 게시된 사실만** 씁니다.

- 첫 문장만 읽어도 답이 되게 씁니다(스니펫 추출 대비).
- 추측성 수치를 넣지 않습니다. 지어낸 숫자는 곧 허위정보로 유통됩니다.
- 근거가 없으면 항목을 만들지 않습니다.

`features.ts`에 새 기능을 추가할 때는 `FeaturesContent.tsx`의 `FEATURE_IMAGES`에
같은 `id`로 이미지를 매핑해야 합니다(콘텐츠와 표현을 분리해 둔 지점).

## MCP 서버

`apps/mcp` — SMAP 콘텐츠를 AI 클라이언트에 제공하는 읽기 전용 MCP 서버.
자세한 내용은 [apps/mcp/README.md](../apps/mcp/README.md).

도구 6종(`smap_search`, `smap_get_overview`, `smap_list_features`, `smap_get_faq`,
`smap_get_page`, `smap_list_pages`), 리소스 3종, 프롬프트 2종을 제공합니다.

stdio(로컬)와 Streamable HTTP(원격) 두 전송을 모두 지원하며,
운영 배포는 PM2의 `smap-mcp`(포트 5126)입니다.

## 배포

```bash
# 0) 검색엔진 소유권 코드 설정 (최초 1회) — 빌드 전에 해야 반영됩니다
cp apps/web/.env.example apps/web/.env.production && vi apps/web/.env.production

# 1) 웹 빌드
cd apps/web && npm run build

# 2) MCP 빌드
cd ../mcp && npm install && npm run build

# 3) PM2 반영
cd ../.. && pm2 reload ecosystem.config.js --only smap-web
pm2 start ecosystem.config.js --only smap-mcp

# 4) nginx — mcp.smap.site 를 쓰려면
sudo cp apps/mcp/deploy/nginx-mcp.conf /etc/nginx/sites-available/mcp.smap.site
sudo ln -s /etc/nginx/sites-available/mcp.smap.site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`nginx-mcp.conf`의 `proxy_buffering off`는 필수입니다.
MCP Streamable HTTP는 SSE로 응답을 흘려보내는데, nginx 기본값은 응답을 모아서 보내므로
스트리밍이 클라이언트에 도달하지 않고 타임아웃처럼 보입니다.

### 배포 후 확인

```bash
curl https://www.smap.site/llms.txt | head -20
curl https://www.smap.site/robots.txt | grep -E "Yeti|Googlebot"        # 검색엔진 규칙
curl https://www.smap.site/robots.txt | grep -c "Disallow: /_next/"     # 0이어야 정상
curl https://www.smap.site/rss.xml | head -10
curl -s https://www.smap.site/ | grep -o 'site-verification[^>]*'       # 소유권 태그
curl "https://www.smap.site/api/ai/search?q=요금" | jq .data.count
curl https://mcp.smap.site/health

cd apps/mcp && npm run smoke                                    # stdio
MCP_URL=https://mcp.smap.site/mcp npm run smoke:http            # HTTP
```

구조화 데이터는 [Google Rich Results Test](https://search.google.com/test/rich-results)와
[Schema Markup Validator](https://validator.schema.org/)로 검증할 수 있습니다.

## 크롤러 정책 변경

`apps/web/src/app/robots.ts`에서 관리합니다.

- `SEARCH_ENGINE_CRAWLERS` — 구글·네이버(Yeti)·다음(Daumoa)·빙 등 전통 검색엔진
- `AI_TRAINING_CRAWLERS` — 학습 데이터 수집형(GPTBot, ClaudeBot, Google-Extended 등)
- `AI_ANSWER_CRAWLERS` — 실시간 인용형(OAI-SearchBot, PerplexityBot, Claude-User 등)

현재는 공개 마케팅 사이트이므로 전부 허용입니다.
학습 수집만 막고 싶다면 `AI_TRAINING_CRAWLERS` 항목의 `allow`를 `disallow`로 바꾸면 됩니다.
실시간 인용형까지 막으면 AI 답변에서 SMAP이 아예 언급되지 않으므로 권장하지 않습니다.

> **`/_next/`를 통째로 막지 마세요.**
> 페이지의 CSS·JS가 `/_next/static/` 아래 있어서, 차단하면 구글봇이 페이지를 렌더링하지 못합니다.
> 구글은 렌더링 결과로 색인과 모바일 친화성을 판단하므로 순위에 직접 손해입니다.
> 현재 설정은 `/_next/static/`과 `/_next/image`를 명시적으로 허용합니다.

## 알려진 제약

- `MobileApplication` JSON-LD에 `aggregateRating`을 넣지 않았습니다.
  홈 화면에 "4.8"이 표기돼 있지만 스토어 집계 근거를 확인하지 못했고,
  검증되지 않은 별점은 구조화 데이터 정책 위반이자 AI 오인용의 원인이 됩니다.
  실제 집계값을 확인하면 `mobileApplicationNode()`에 추가할 수 있습니다.
- 홈 화면의 "10K+ 활성 사용자", "99.9% 위치 정확도"도 같은 이유로
  AI-ready 데이터에는 넣지 않았습니다.
- MCP 서버는 웹사이트를 데이터 소스로 삼으므로, 웹이 내려가면 MCP도 응답할 수 없습니다
  (오류 메시지로 안내됩니다).

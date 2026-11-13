# @smap/mcp-server

SMAP 서비스의 공개 콘텐츠(페이지·기능·FAQ)를 AI 클라이언트에 제공하는 **읽기 전용 MCP 서버**입니다.

Claude Desktop, Claude Code, Cursor 등 MCP를 지원하는 클라이언트에 연결하면
SMAP에 대한 질문에 추측 대신 공식 자료를 근거로 답하게 됩니다.

## 무엇을 제공하나

| 도구 | 용도 |
|------|------|
| `smap_search` | 페이지·기능·FAQ 통합 검색. 대부분의 질문은 여기서 시작 |
| `smap_get_overview` | 서비스 정의·요금·플랫폼·다운로드 링크 |
| `smap_list_features` | 기능 7종의 요약과 세부 항목 |
| `smap_get_faq` | 공식 FAQ 19개. 카테고리 필터 지원 |
| `smap_get_page` | 페이지 전문(마크다운) |
| `smap_list_pages` | 페이지 목록과 요약 |

| 리소스 | 내용 |
|--------|------|
| `smap://overview` | 서비스 개요 마크다운 |
| `smap://llms-full` | 전체 페이지를 합친 마크다운 |
| `smap://pages/{slug}` | 개별 페이지 마크다운 |

| 프롬프트 | 용도 |
|----------|------|
| `smap_answer_customer` | 고객 문의 답변 초안 (공식 자료 근거) |
| `smap_introduce` | 대상별 서비스 소개문 작성 |

## 데이터 출처

이 서버는 콘텐츠를 자체 보관하지 않고 `www.smap.site`의 `/api/ai/*` 를 호출합니다.

```
apps/web/src/content/*  (SSOT)
        ↓
apps/web /api/ai/*, /llms.txt, /md/*
        ↓
apps/mcp (이 패키지)
        ↓
AI 클라이언트
```

웹사이트 콘텐츠를 고치면 MCP 재배포 없이 즉시 반영됩니다.
반대로 말하면 웹이 내려가면 이 서버도 데이터를 제공할 수 없습니다(오류 메시지로 안내).

## 설치와 실행

```bash
npm install
npm run build
```

### stdio 모드 (로컬 클라이언트)

Claude Desktop의 `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "smap": {
      "command": "node",
      "args": ["/절대경로/smap/apps/mcp/dist/stdio.js"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add smap -- node /절대경로/smap/apps/mcp/dist/stdio.js
```

### HTTP 모드 (원격 배포)

```bash
npm run start:http
# http://127.0.0.1:5126/mcp 에서 대기, /health 로 상태 확인
```

무상태(stateless) 모드로 동작해 요청마다 서버 인스턴스를 새로 만듭니다.
세션 상태가 없어 수평 확장과 재시작이 자유롭습니다.

PM2로는 저장소 루트의 `ecosystem.config.js`에 정의된 `smap-mcp`로 실행됩니다.

```bash
pm2 start ecosystem.config.js --only smap-mcp
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `SMAP_AI_BASE_URL` | `https://www.smap.site` | 콘텐츠를 가져올 웹 서버 |
| `SMAP_REQUEST_TIMEOUT_MS` | `10000` | 업스트림 요청 타임아웃 |
| `SMAP_CACHE_TTL_MS` | `300000` | 응답 캐시 TTL. `0`이면 캐시 끔 |
| `SMAP_MCP_PORT` | `5126` | HTTP 모드 포트 |
| `SMAP_MCP_HOST` | `127.0.0.1` | HTTP 모드 바인드 호스트 |

## 검증

```bash
npm run smoke                                        # stdio 전송 (운영 데이터)
SMAP_AI_BASE_URL=http://127.0.0.1:3000 npm run smoke # 로컬 웹 대상
npm run start:http & MCP_URL=http://127.0.0.1:5126/mcp npm run smoke:http
npm run inspect                                      # MCP Inspector GUI
```

스모크 테스트는 실제 MCP 클라이언트로 붙어 도구 등록과 호출 결과를 모두 확인합니다.

## 보안

- **읽기 전용.** 모든 도구가 `readOnlyHint`이며 쓰기 동작이 없습니다.
- **공개 데이터만.** 사용자 위치·계정 등 인증이 필요한 데이터는 다루지 않습니다.
- **인증 없음.** 제공하는 정보가 이미 웹사이트에 공개된 내용이라 별도 인증을 두지 않았습니다.
  인증이 필요한 데이터를 추가하려면 그 시점에 OAuth를 붙여야 합니다.

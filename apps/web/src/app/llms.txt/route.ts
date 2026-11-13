import { COMPANY, PROJECTS } from "@/content/site";

export const dynamic = "force-static";

export function GET(): Response {
  const projects = PROJECTS.map((project) => "- [" + project.name + "](" + project.url + "): " + project.description).join("\n");
  const content = [
    "# " + COMPANY.name,
    "> " + COMPANY.description,
    "",
    "비욘드리얼은 AI 서비스와 교육 콘텐츠를 만드는 회사입니다.",
    "PersonaFit · 하루책 · 구구 어드벤처 · 모의창구 · 10percent(Toss 프로젝트), 총 5개 프로젝트를 소개합니다.",
    "",
    "## 프로젝트",
    projects,
    "",
    "## 회사 소개",
    "- [회사 소개와 프로젝트](" + COMPANY.url + "/md/home): 회사의 방향, 다섯 프로젝트, 협업 안내",
    "- [전체 콘텐츠](" + COMPANY.url + "/llms-full.txt): 회사 소개와 기존 SMAP 서비스 안내",
    "",
    "## 협업 문의",
    "- 이메일: " + COMPANY.email,
    "- 회사명: " + COMPANY.legalName,
    "- 대표: " + COMPANY.representative,
    "",
    "## 기존 SMAP 이용 안내",
    "- [SMAP 주요 기능](" + COMPANY.url + "/features)",
    "- [SMAP 자주 묻는 질문](" + COMPANY.url + "/faq)",
    "- [SMAP 개인정보 처리방침](" + COMPANY.url + "/legal/privacy)",
    "- [SMAP 계정 삭제 안내](" + COMPANY.url + "/account-deletion)",
    "",
    "10percent는 모의투자 기록을 공개하는 연구 프로젝트입니다.",
    "PersonaFit과 모의창구는 합성 페르소나 기반의 시뮬레이션입니다.",
  ].join("\n");
  return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}

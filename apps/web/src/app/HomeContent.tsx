"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { COMPANY, PROJECTS } from "@/content/site";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={diagonal ? "br-arrow br-arrow-diagonal" : "br-arrow"}><path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ProjectPreview({ id }: { id: string }) {
  if (id === "personafit") return (
    <div className="br-preview br-preview-persona" aria-hidden="true">
      <div className="br-preview-top"><span className="br-preview-symbol">p<span>.</span></span><span>사람을 이해하는 AI</span><span className="br-preview-number">01</span></div>
      <div className="br-persona-orbit"><div /><div /><div /></div>
      <div className="br-persona-window">
        <div className="br-window-bar"><span className="br-window-dots"><i /><i /><i /></span><span>PersonaFit</span><span className="br-window-label">타겟 분석</span></div>
        <div className="br-persona-content"><span className="br-preview-kicker">아이디어를 고객과 연결하다</span><h4>우리의 고객은<br />어떤 사람일까요?</h4>
          <div className="br-persona-people">{["새로움을 찾는", "일상을 가꾸는", "내일을 준비하는"].map((text, i) => <div key={text}><span className={"br-avatar br-avatar-" + i}><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="12" r="5" fill="currentColor" /><path d="M7 28v-4a9 9 0 0 1 18 0v4" fill="currentColor" /></svg></span><span>{text}<b>사람들</b></span></div>)}</div>
          <div className="br-persona-note"><span className="br-status-dot" />100만 합성 페르소나에서 시작하는 이해</div>
        </div>
      </div>
      <span className="br-preview-caption">아이디어와 사람 사이, 새로운 연결.</span>
    </div>
  );
  if (id === "harubook") return (
    <div className="br-preview br-preview-haru" aria-hidden="true">
      <div className="br-preview-top"><span className="br-preview-symbol br-book-symbol"><svg viewBox="0 0 28 28" fill="none"><path d="M14 7c-4-3-8-3-11-2v17c4-1 8-1 11 2 3-3 7-3 11-2V5c-3-1-7-1-11 2Zm0 0v17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg></span><span>매일 한 권, 나만의 영어 동화</span><span className="br-preview-number">02</span></div>
      <span className="br-haru-spark br-spark-one">✦</span><span className="br-haru-spark br-spark-two">✧</span>
      <div className="br-haru-book br-haru-book-back" />
      <div className="br-haru-book"><div className="br-book-spine" /><span className="br-book-brand">하루책</span><span className="br-book-title">오늘은 어떤<br />모험을 떠날까요?</span><Image src="/images/beyondreal/haru-bear.webp" alt="" width={250} height={250} className="br-haru-bear" /><span className="br-book-bottom">나에게 꼭 맞는 오늘의 이야기</span></div>
      <div className="br-haru-audio"><span className="br-audio-play">▶</span><span>읽고, 듣고, 자라는 하루</span><div className="br-audio-wave">{[0, 1, 2, 3, 4].map((n) => <i key={n} style={{ animationDelay: n * 0.16 + "s" }} />)}</div></div>
      <span className="br-preview-caption">작은 이야기 한 권이, 더 큰 세상으로.</span>
    </div>
  );
  if (id === "gugu") return (
    <div className="br-preview br-preview-gugu" aria-hidden="true">
      <div className="br-preview-top"><span className="br-preview-symbol">g<span>.</span></span><span>구구단이 모험이 된다</span><span className="br-preview-number">03</span></div>
      <div className="br-gugu-copy"><span className="br-preview-kicker">하나씩 도전하는 즐거움</span><h4>놀다 보니,<br />어느새<br /><em>자신감.</em></h4><div className="br-gugu-stars">★ ★ ★</div></div>
      <div className="br-gugu-phone"><div className="br-phone-notch" /><Image src="/images/beyondreal/gugu-world.webp" alt="" width={600} height={1304} /></div>
      <span className="br-gugu-equation">7 × 8 = <b>56</b><span>정답!</span></span>
      <span className="br-preview-caption">한 번 더 놀고 싶은, 한 번 더 배우는.</span>
    </div>
  );
  if (id === "modu") return (
    <div className="br-preview br-preview-modu" aria-hidden="true">
      <div className="br-preview-top"><span className="br-preview-symbol">m<span>.</span></span><span>설명과 이해 사이를 살피다</span><span className="br-preview-number">04</span></div>
      <div className="br-modu-document"><span className="br-doc-fold" /><span className="br-preview-kicker">금융상품 설명서</span><div className="br-doc-line" /><div className="br-doc-line" /><div className="br-doc-line short" /><div className="br-doc-highlight" /><div className="br-doc-line" /><div className="br-doc-line short" /></div>
      <div className="br-modu-panel"><span className="br-preview-kicker">연령 × 투자 경험</span><h4>어디에서 이해가<br />멈췄을까요?</h4><div className="br-heatmap">{Array.from({ length: 9 }, (_, i) => <span key={i} className={"br-heat-" + i} />)}</div><div className="br-heatmap-legend"><span>이해도를 살피고</span><span>설명을 더 쉽게</span></div></div>
      <span className="br-preview-caption">누구에게나 이해되는 설명을 위해.</span>
    </div>
  );
  return (
    <div className="br-preview br-preview-toss" aria-hidden="true">
      <div className="br-preview-top"><span className="br-preview-symbol">10<span>%</span></span><span>AI 금융 리서치 · 모의투자 기록</span><span className="br-preview-number">05</span></div>
      <div className="br-toss-copy"><span className="br-preview-kicker">10percent</span><h4>가설을 세우고.<br />데이터로 확인하고.<br /><em>기록으로 남깁니다.</em></h4><span className="br-toss-caption">시장 관찰 → 모의투자 → 결과 검증</span></div>
      <div className="br-toss-chart"><div className="br-chart-top"><span>관찰. 가설. 검증.</span><span className="br-chart-badge">연구 프로젝트</span></div><div className="br-chart-grid"><svg viewBox="0 0 420 150" preserveAspectRatio="none"><defs><linearGradient id="br-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b8cc89" stopOpacity=".2" /><stop offset="100%" stopColor="#b8cc89" stopOpacity="0" /></linearGradient></defs><path d="M0 112 26 105 50 118 76 95 103 101 125 83 150 91 178 65 203 75 230 56 253 69 279 39 302 52 330 31 352 48 380 25 420 34V150H0Z" fill="url(#br-chart-fill)" /><path d="M0 112 26 105 50 118 76 95 103 101 125 83 150 91 178 65 203 75 230 56 253 69 279 39 302 52 330 31 352 48 380 25 420 34" stroke="#b8cc89" strokeWidth="2.5" fill="none" strokeLinejoin="round" /></svg></div><div className="br-chart-bottom"><span>후보 분석</span><span>거래 기록</span><span>가설 검증</span></div></div>
      <span className="br-preview-caption">차트는 화면 구성 예시입니다. 실제 기록은 서비스에서 확인하세요.</span>
    </div>
  );
}

const filters = [
  { id: "all", label: "전체 프로젝트" },
  { id: "ai", label: "AI · 리서치" },
  { id: "education", label: "교육 콘텐츠" },
] as const;

const principles = [
  { number: "01", title: "사람에서 시작합니다.", body: "무엇을 만들 수 있는지보다, 누구의 어떤 문제를 풀 것인지 먼저 묻습니다.", tags: "공감 · 관찰 · 질문", glyph: "people" },
  { number: "02", title: "기술로 가능성을 넓힙니다.", body: "AI의 분석과 생성 능력을 실제 문제에 연결해, 새로운 선택지를 만듭니다.", tags: "분석 · 생성 · 실험", glyph: "orbit" },
  { number: "03", title: "경험으로 완성합니다.", body: "쉽게 이해하고 즐겁게 사용할 때 기술은 일상이 됩니다. 작은 경험까지 다듬습니다.", tags: "사용성 · 몰입 · 성장", glyph: "spark" },
];

export default function HomeContent() {
  const [filter, setFilter] = useState<string>("all");
  const [copyStatus, setCopyStatus] = useState("");
  const artRef = useRef<HTMLDivElement>(null);
  const visibleProjects = PROJECTS.filter((project) => filter === "all" || project.category === filter);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    const observe = () => {
      document.documentElement.dataset.brMotion = media.matches ? "off" : "on";
      document.querySelectorAll("[data-br-reveal]").forEach((element) => observer.observe(element));
    };
    observe();
    media.addEventListener("change", observe);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", observe);
      delete document.documentElement.dataset.brMotion;
    };
  }, []);

  useEffect(() => {
    if (!copyStatus) return;
    const timer = window.setTimeout(() => setCopyStatus(""), 4000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  function moveArt(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    artRef.current?.style.setProperty("--br-mx", ((event.clientX - rect.left) / rect.width - 0.5) * 16 + "px");
    artRef.current?.style.setProperty("--br-my", ((event.clientY - rect.top) / rect.height - 0.5) * 12 + "px");
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(COMPANY.email);
      setCopyStatus("이메일 주소를 복사했습니다.");
    } catch {
      setCopyStatus("복사하지 못했습니다. 이메일 주소를 직접 선택해 주세요.");
    }
  }

  return (
    <main id="main-content" className="br-main" tabIndex={-1}>
      <section className="br-hero" aria-labelledby="br-hero-title">
        <div className="br-container br-hero-grid">
          <div className="br-hero-copy">
            <div className="br-eyebrow br-hero-eyebrow"><span className="br-status-dot" />AI · 교육 · 새로운 경험</div>
            <h1 id="br-hero-title"><span>기술은 더 멀리.</span><span>일상은 <em>더 가까이.</em></span></h1>
            <p className="br-hero-description">사람을 이해하는 AI, 즐겁게 배우는 콘텐츠.<br />비욘드리얼은 기술의 가능성을<br className="br-mobile-break" /> 누구나의 일상으로 연결합니다.</p>
            <div className="br-hero-actions"><a className="br-button br-button-dark" href="#projects">우리가 만드는 것 <Arrow /></a><a className="br-text-link" href="#about">비욘드리얼을 소개합니다 <Arrow diagonal /></a></div>
            <div className="br-hero-footnote"><span className="br-small-cross" aria-hidden="true">+</span>가능성을 현실로 만드는 다섯 가지 프로젝트.</div>
          </div>
          <div className="br-hero-art" ref={artRef} onPointerMove={moveArt} onPointerLeave={() => {
            artRef.current?.style.setProperty("--br-mx", "0px");
            artRef.current?.style.setProperty("--br-my", "0px");
          }}>
            <div className="br-art-ring br-art-ring-one" /><div className="br-art-ring br-art-ring-two" />
            <span className="br-art-coordinate br-coordinate-top" aria-hidden="true">상상에서 시작해</span>
            <div className="br-hero-sculpture"><Image src="/images/beyondreal/beyond-loop.webp" alt="두 가능성이 하나의 흐름으로 연결되는 주홍색 입체 고리" width={1120} height={1120} preload sizes="(max-width: 700px) 92vw, (max-width: 1100px) 50vw, 650px" /></div>
            <span className="br-art-coordinate br-coordinate-bottom" aria-hidden="true"><span className="br-status-dot" />일상으로 이어지는 가능성</span>
          </div>
        </div>
        <div className="br-container br-hero-bottom"><span>가능성에 머물지 않고, 현실을 만듭니다.</span><a href="#about" aria-label="회사 소개로 내려가기"><span>더 알아보기</span><Arrow /></a></div>
      </section>

      <section id="about" className="br-about br-section" aria-labelledby="br-about-title">
        <div className="br-container br-about-grid">
          <div className="br-section-label" data-br-reveal><span className="br-section-index">01 / 회사 소개</span><span className="br-about-symbol" aria-hidden="true">b<span>r.</span></span><p>경계를 넘어,<br />더 넓은 일상으로.</p></div>
          <div className="br-about-content" data-br-reveal><h2 id="br-about-title">새로운 기술의 끝에는,<br />늘 <span className="br-accent">사람이 있습니다.</span></h2><p>아이의 첫 영어책에서 기업의 새로운 아이디어까지.<br />비욘드리얼은 서로 다른 일상에 같은 질문을 던집니다.</p><blockquote>“기술로 이 경험을 더 좋게 만들 수 없을까?”</blockquote><p>AI로 사람을 더 깊이 이해하고, 콘텐츠로 배움의 즐거움을 넓힙니다. 크고 먼 미래보다, 오늘 손에 닿는 변화를 만듭니다.</p><div className="br-about-values"><span><b>이해</b>사람을 더 깊이</span><span><b>배움</b>세상을 더 즐겁게</span><span><b>경험</b>일상을 더 새롭게</span></div></div>
        </div>
      </section>

      <section id="projects" className="br-projects br-section" aria-labelledby="br-projects-title">
        <div className="br-container">
          <div className="br-section-heading" data-br-reveal><div><span className="br-section-index">02 / 우리가 만드는 것</span><h2 id="br-projects-title">다섯 가지 가능성.<br /><span className="br-muted">하나의 방향.</span></h2></div><p>더 잘 이해하고, 더 즐겁게 배우고,<br />더 넓게 경험하는 일상.<br />우리는 서비스로 이야기합니다.</p></div>
          <div className="br-project-filter-row"><div className="br-project-filters" role="group" aria-label="프로젝트 분류">{filters.map((item) => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={filter === item.id ? "is-active" : ""}>{item.label}<span>{item.id === "all" ? PROJECTS.length : PROJECTS.filter((p) => p.category === item.id).length}</span></button>)}</div><span className="br-project-count" role="status" aria-live="polite">{visibleProjects.length}개의 프로젝트</span></div>
          <div className="br-project-grid">{visibleProjects.map((project) => (
            <article key={project.id} className={"br-project-card br-project-" + project.id}>
              <a href={project.url} className="br-project-link" target="_blank" rel="noopener noreferrer" aria-label={project.action + " (새 창)"}>
                <ProjectPreview id={project.id} />
                <div className="br-project-info"><div className="br-project-title-row"><div><span className="br-project-category">{project.label}</span><h3>{project.name}</h3></div><span className="br-project-go"><Arrow diagonal /></span></div><h4>{project.tagline}</h4><p>{project.description}</p><div className="br-project-tags">{project.features.map((feature) => <span key={feature}>{feature}</span>)}</div><span className="br-project-visit">{project.action}<Arrow /></span></div>
              </a>
            </article>
          ))}</div>
          <div className="br-project-closing"><span className="br-small-cross" aria-hidden="true">+</span><p>서로 다른 서비스, 같은 마음.<br className="br-mobile-break" /> 기술이 사람에게 닿는 방법을 계속 찾습니다.</p><a className="br-text-link" href="#contact">다음 가능성을 함께 <Arrow diagonal /></a></div>
        </div>
      </section>

      <section id="approach" className="br-approach br-section" aria-labelledby="br-approach-title">
        <div className="br-container"><div className="br-section-heading" data-br-reveal><div><span className="br-section-index">03 / 우리의 방식</span><h2 id="br-approach-title">좋은 기술은,<br /><span>좋은 경험으로 완성됩니다.</span></h2></div><p>새로운 도구보다 오래 남는 경험을.<br />우리가 만들 때 지키는 세 가지 원칙입니다.</p></div>
          <div className="br-principles">{principles.map((principle) => <article key={principle.number} data-br-reveal><div className="br-principle-top"><span>{principle.number}</span><svg viewBox="0 0 80 80" fill="none" aria-hidden="true">{principle.glyph === "people" ? <><circle cx="40" cy="28" r="11" stroke="currentColor" strokeWidth="1.5" /><path d="M18 65v-6a22 22 0 0 1 44 0v6M17 18a10 10 0 0 0-3 19M66 18a10 10 0 0 1 0 19M7 57v-5a16 16 0 0 1 8-14M73 57v-5a16 16 0 0 0-8-14" stroke="currentColor" strokeWidth="1.5" /></> : principle.glyph === "orbit" ? <><ellipse cx="40" cy="40" rx="33" ry="14" stroke="currentColor" strokeWidth="1.5" transform="rotate(-40 40 40)" /><ellipse cx="40" cy="40" rx="33" ry="14" stroke="currentColor" strokeWidth="1.5" transform="rotate(40 40 40)" /><circle cx="40" cy="40" r="4" fill="currentColor" /></> : <path d="M40 5v70M5 40h70M15 15l50 50M15 65l50-50M40 5c0 20-15 35-35 35 20 0 35 15 35 35 0-20 15-35 35-35-20 0-35-15-35-35Z" stroke="currentColor" strokeWidth="1.3" />}</svg></div><h3>{principle.title}</h3><p>{principle.body}</p><span className="br-principle-tags">{principle.tags}</span></article>)}</div>
          <div className="br-approach-bottom" data-br-reveal><span>사람 → 기술 → 경험</span><p>가능성을 현실로 만드는 우리의 순서.</p><span className="br-approach-star" aria-hidden="true">✳</span></div>
        </div>
      </section>

      <section id="contact" className="br-contact br-section" aria-labelledby="br-contact-title">
        <div className="br-container"><div className="br-contact-grid" data-br-reveal><div><span className="br-section-index">04 / 다음 가능성</span><h2 id="br-contact-title">다음의 가능성은,<br /><em>함께</em> 만듭니다.</h2><p>AI로 풀고 싶은 문제, 새롭게 만들고 싶은 배움.<br />작은 질문에서 시작해도 좋습니다.<br />비욘드리얼과 이야기를 나눠보세요.</p><div className="br-contact-types"><span>서비스 제휴</span><span>AI 솔루션 협업</span><span>교육 콘텐츠</span></div></div><div className="br-contact-card"><span className="br-contact-card-label"><span className="br-status-dot" />새로운 이야기를 기다립니다</span><div className="br-contact-card-icon" aria-hidden="true"><Arrow diagonal /></div><h3>어떤 가능성을<br />함께 만들어볼까요?</h3><a href={"mailto:" + COMPANY.email + "?subject=" + encodeURIComponent("[Beyondreal] 협업 문의")} className="br-button br-button-dark">협업 문의하기 <Arrow diagonal /></a><div className="br-contact-email"><a href={"mailto:" + COMPANY.email}>{COMPANY.email}</a><button type="button" onClick={copyEmail} aria-label="이메일 주소 복사"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="1.6" /></svg></button></div><p className="br-copy-status" role="status" aria-live="polite">{copyStatus || "문의 버튼을 누르면 이메일 앱이 열립니다."}</p></div></div></div>
      </section>
    </main>
  );
}

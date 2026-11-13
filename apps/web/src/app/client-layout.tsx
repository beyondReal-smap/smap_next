"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COMPANY, PROJECTS } from "@/content/site";

const navigation = [
  { href: "/#about", label: "회사 소개" },
  { href: "/#projects", label: "우리가 만드는 것" },
  { href: "/#approach", label: "우리의 방식" },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 900px)");
    const closeDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    desktop.addEventListener("change", closeDesktop);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
      desktop.removeEventListener("change", closeDesktop);
    };
  }, [menuOpen]);

  return (
    <div className="br-site">
      <a href="#main-content" className="br-skip">본문 바로가기</a>
      <header className="br-header" ref={headerRef} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
      }}>
        <div className="br-container br-header-inner">
          <Link href="/" className="br-brand" aria-label="비욘드리얼 홈" onClick={() => setMenuOpen(false)}>
            <Image src={COMPANY.logo} alt="" width={34} height={34} />
            <span>beyondreal<span className="br-brand-period">.</span></span>
          </Link>
          <nav className="br-desktop-nav" aria-label="주 메뉴">
            {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
          <div className="br-header-actions">
            <Link href="/#contact" className="br-header-contact" onClick={() => setMenuOpen(false)}>
              함께하기 <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.7" /></svg>
            </Link>
            <button type="button" className={"br-menu-toggle" + (menuOpen ? " is-open" : "")}
              ref={buttonRef} onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen}
              aria-controls="br-mobile-navigation">
              <span /><span />
            </button>
          </div>
        </div>
        <nav id="br-mobile-navigation" className="br-mobile-nav" hidden={!menuOpen} aria-label="모바일 주 메뉴">
          {[...navigation, { href: "/#contact", label: "함께하기" }].map((item, i) => (
            <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
              <span className="br-mobile-index">0{i + 1}</span>{item.label}<span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
      </header>
      <div className={"br-page" + (pathname !== "/" ? " br-legacy-page" : "")}
        id={pathname !== "/" ? "main-content" : undefined} tabIndex={pathname !== "/" ? -1 : undefined}>
        {children}
      </div>
      <footer className="br-footer">
        <div className="br-container">
          <div className="br-footer-top">
            <Link href="/" className="br-brand" aria-label="비욘드리얼 홈">
              <Image src={COMPANY.logo} alt="" width={32} height={32} /><span>beyondreal<span className="br-brand-period">.</span></span>
            </Link>
            <p>가능성을 현실로.<br />기술을 일상으로.</p>
            <nav aria-label="서비스 바로가기" className="br-footer-projects">
              {PROJECTS.map((project) => <a href={project.url} key={project.id} target="_blank" rel="noopener noreferrer">{project.name}<span aria-hidden="true">↗</span><span className="br-sr-only"> (새 창)</span></a>)}
            </nav>
          </div>
          <div className="br-footer-wordmark" aria-hidden="true">beyondreal<span>.</span></div>
          <div className="br-footer-bottom">
            <p>{COMPANY.legalName} · 대표 {COMPANY.representative} · 사업자등록번호 {COMPANY.registrationNumber}<br />{COMPANY.address}</p>
            <div><a href={"mailto:" + COMPANY.email}>{COMPANY.email}</a><span>© {new Date().getFullYear()} Beyondreal</span></div>
          </div>
          <div className="br-footer-legal">
            <span>SMAP 이용 안내</span><Link href="/legal/privacy">개인정보 처리방침</Link><Link href="/account-deletion">계정 삭제 안내</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * /production 전용 헤더
 * 메인 사이트 nav 와 완전히 분리된 유튜브 제작 서비스 전용 내비게이션.
 * 원페이지 구조 — 항목은 페이지 내 앵커로 이동한다.
 */

const anchors = [
  { href: "#work", label: "WORK" },
  { href: "#system", label: "SYSTEM" },
  { href: "#services", label: "SERVICES" },
  { href: "#about", label: "ABOUT" },
];

export default function ProductionHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* 로고 — 프로덕션 섹션 홈 */}
        <Link
          href="/production"
          className="font-display text-xl font-bold tracking-tight"
        >
          <span className="text-primary">UNTITLED</span>PRODUCTION
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-8 md:flex">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="font-display text-xs font-semibold tracking-widest text-sub-text transition-colors duration-200 hover:text-primary"
            >
              {a.label}
            </a>
          ))}
          <a
            href="#contact"
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-background transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            제작 문의
          </a>
          <Link
            href="/"
            className="text-xs text-sub-text/60 transition-colors hover:text-white"
          >
            ← 메인 사이트
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex flex-col gap-1.5 p-2 md:hidden"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="메뉴 열기"
        >
          <span
            className={`block h-0.5 w-6 bg-foreground transition-transform duration-300 ${isOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-foreground transition-opacity duration-300 ${isOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-foreground transition-transform duration-300 ${isOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-border bg-background md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {anchors.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  onClick={() => setIsOpen(false)}
                  className="font-display text-sm font-semibold tracking-widest text-sub-text transition-colors hover:text-primary"
                >
                  {a.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-primary px-5 py-3 text-center font-semibold text-background"
              >
                제작 문의
              </a>
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="text-sm text-sub-text/60"
              >
                ← 메인 사이트로 돌아가기
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

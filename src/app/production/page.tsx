"use client";

import { useState } from "react";
import FadeInSection from "@/components/FadeInSection";
import ProcessSection from "@/components/production/ProcessSection";
import SamplesSection from "@/components/production/SamplesSection";
import PricingSection from "@/components/production/PricingSection";
import ComplianceSection from "@/components/production/ComplianceSection";
import FaqSection from "@/components/production/FaqSection";
import LeadForm from "@/components/production/LeadForm";
import KakaoFloat from "@/components/production/KakaoFloat";
import { stats, cases, samples } from "@/config/production";

/**
 * /production — 병원·변호사 유튜브 제작·운영 원페이지
 * 전용 헤더(ProductionHeader)의 앵커(#about #process #work #pricing #faq #apply)와 연결.
 * 숫자·케이스·가격 등 바뀌는 값은 src/config/production.ts 에서 관리.
 */

/* ── 제작 파이프라인 ── */
const PIPELINE = [
  "CHANNEL STRATEGY",
  "CONTENT PLANNING",
  "PRE-PRODUCTION",
  "PRODUCTION",
  "POST-PRODUCTION",
  "PUBLISHING",
  "PERFORMANCE REVIEW",
];

/* ── 운영 시스템 단계 ── */
const SYSTEM_STEPS = [
  {
    no: "01",
    title: "채널 진단 · 전략",
    desc: "병원·사무소의 현재 상황과 목표를 정리하고, 어떤 환자·의뢰인에게 어떤 콘텐츠로 닿을지 방향을 세웁니다.",
  },
  {
    no: "02",
    title: "콘텐츠 기획",
    desc: "환자·의뢰인이 실제로 검색하는 질문을 기반으로 월 단위 콘텐츠 주제를 설계합니다.",
  },
  {
    no: "03",
    title: "촬영 준비 · 촬영",
    desc: "키워드 정리, 화법 코칭, 촬영 세팅까지. 원장님·변호사님은 말씀하시는 것에만 집중하시면 됩니다.",
  },
  {
    no: "04",
    title: "편집 · 후반 작업",
    desc: "채널 톤에 맞는 편집, 자막, 썸네일까지 발행 가능한 완성본으로 만듭니다.",
  },
  {
    no: "05",
    title: "발행 · 운영",
    desc: "업로드 시점, 제목, 설명, 태그를 관리하고 쇼츠·커뮤니티로 채널을 움직입니다.",
  },
  {
    no: "06",
    title: "성과 리뷰",
    desc: "데이터를 바탕으로 다음 달 운영 방향을 함께 판단합니다. 만들고 끝나지 않습니다.",
  },
];

/* ── 서비스 구성 ── */
const SERVICES = [
  {
    title: "채널 운영 대행",
    desc: "기획부터 촬영, 편집, 발행, 리포트까지 월 단위로 채널 전체를 맡는 파트너십.",
    tag: "MONTHLY",
  },
  {
    title: "영상 제작",
    desc: "기획안 또는 촬영본을 받아 편집·후반 작업으로 완성하는 건별 제작.",
    tag: "PER PROJECT",
  },
  {
    title: "채널 컨설팅",
    desc: "채널 진단과 콘텐츠 방향 설계. 병원·사무소에서 직접 운영하실 분들을 위한 기준을 만들어 드립니다.",
    tag: "CONSULTING",
  },
];

export default function ProductionPage() {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const visibleStats = stats.filter((s) => s.value.trim());

  /* 섹션 번호 — 조건부 섹션(샘플 등)이 숨겨져도 번호가 이어지도록 */
  let sectionCount = 0;
  const nextNo = () => String(++sectionCount).padStart(2, "0");

  return (
    <div className="scroll-smooth bg-background">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        <FadeInSection>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            YouTube for Doctors &amp; Lawyers
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            영상을 못 하시는 게 아니라,
            <br />
            <span className="text-primary">어떻게 시작할지</span> 모르셨던 겁니다.
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-sub-text md:text-lg">
            병원·법률 전문 유튜브 — 기획부터 촬영, 편집, 업로드까지 한 팀이 맡습니다.
            <br />
            원장님·변호사님이 내주실 시간은 한 달에 반나절이면 됩니다.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#apply"
              className="w-full rounded-xl bg-primary px-8 py-4 text-base font-bold text-background transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
            >
              기획 진단 신청하기
            </a>
            <a
              href="#process"
              className="w-full rounded-xl border border-border px-8 py-4 text-base font-semibold text-white transition-all duration-200 hover:border-primary hover:text-primary sm:w-auto"
            >
              진행 방식 보기
            </a>
          </div>
        </FadeInSection>

        {/* 파이프라인 스트립 */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden border-t border-border/60 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6">
            {PIPELINE.map((step, i) => (
              <span
                key={step}
                className="flex items-center gap-6 font-display text-[10px] font-semibold tracking-[0.2em] text-sub-text/60"
              >
                {step}
                {i < PIPELINE.length - 1 && (
                  <span className="text-primary/40">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ABOUT / WHAT WE DO ═══════════ */}
      <section id="about" className="scroll-mt-24 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
              {nextNo()} — WHAT WE DO
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-snug text-white md:text-4xl">
              잘 만든 영상과
              <br />
              환자·의뢰인이 찾아오는 채널은 다릅니다.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-sub-text">
              영상 편집만 8년을 하다 보니, 기획이 문제인 영상을 너무 많이
              봤습니다. 전문성은 충분한데 무엇을 찍을지, 어떤 순서로 말할지가
              정리되지 않아 멈춰 있는 채널들이요. 그래서 기획·촬영·편집을 한
              번에 맡는 팀을 만들었습니다. 원장님·변호사님은 본업에 집중하시고,
              매달 반복되는 운영 실무는 저희가 맡습니다.
            </p>
          </FadeInSection>

          {/* 숫자 지표 — config 의 stats, 비어 있으면 숨김 */}
          {visibleStats.length > 0 && (
            <FadeInSection delay={0.15}>
              <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {visibleStats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-border bg-card p-6"
                  >
                    <p className="font-display text-2xl font-bold text-primary md:text-3xl">
                      {s.value}
                    </p>
                    <p className="mt-2 text-xs text-sub-text">{s.label}</p>
                  </div>
                ))}
              </div>
            </FadeInSection>
          )}
        </div>
      </section>

      {/* ═══════════ PROCESS (진행 방식 4단계) ═══════════ */}
      <ProcessSection no={nextNo()} />

      {/* ═══════════ SELECTED WORK — config 의 cases, 비어 있으면 숨김 ═══════════ */}
      {cases.length > 0 && (
        <section id="work" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
          <div className="mx-auto max-w-5xl">
            <FadeInSection>
              <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
                {nextNo()} — SELECTED WORK
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
                결과만 보여드리지 않습니다.
                <br />
                무엇을 맡았는지 함께 보여드립니다.
              </h2>
            </FadeInSection>

            <div className="mt-14 space-y-6">
              {cases.map((c, i) => (
                <FadeInSection key={c.client} delay={i * 0.1}>
                  <div className="rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:border-primary/50">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          {c.client}
                        </h3>
                        <p className="mt-1 text-sm text-sub-text">
                          {c.channel} · {c.summary}
                        </p>
                      </div>
                      <span className="inline-flex flex-shrink-0 items-center rounded-lg bg-primary/10 px-3 py-1.5 font-display text-sm font-bold text-primary">
                        {c.growth}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                      {[
                        { label: "BEFORE", text: c.before },
                        { label: "ACTION", text: c.action },
                        { label: "AFTER", text: c.after },
                      ].map((step) => (
                        <div
                          key={step.label}
                          className="rounded-xl border border-border/60 bg-background p-4"
                        >
                          <p className="font-display text-[10px] font-bold tracking-[0.2em] text-primary">
                            {step.label}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-sub-text">
                            {step.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ SYSTEM ═══════════ */}
      <section id="system" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
              {nextNo()} — SYSTEM
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
              매달 같은 기준으로 굴러가는
              <br />
              운영 시스템
            </h2>
          </FadeInSection>

          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            {SYSTEM_STEPS.map((step, i) => (
              <FadeInSection key={step.no} delay={i * 0.06}>
                <div className="h-full rounded-2xl border border-border bg-card p-6">
                  <p className="font-display text-sm font-bold text-primary">
                    {step.no}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-sub-text">
                    {step.desc}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SERVICES ═══════════ */}
      <section id="services" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
              {nextNo()} — SERVICES
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
              필요한 만큼,
              <br />
              맞는 방식으로 함께합니다.
            </h2>
          </FadeInSection>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {SERVICES.map((s, i) => (
              <FadeInSection key={s.title} delay={i * 0.1}>
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50">
                  <span className="font-display text-[10px] font-bold tracking-[0.2em] text-primary">
                    {s.tag}
                  </span>
                  <h3 className="mt-3 text-xl font-bold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-sub-text">
                    {s.desc}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SAMPLES — samples 비어 있으면 숨김 ═══════════ */}
      {samples.length > 0 && <SamplesSection no={nextNo()} />}

      {/* ═══════════ PRICING ═══════════ */}
      <PricingSection no={nextNo()} onSelectPackage={setSelectedPackage} />

      {/* ═══════════ COMPLIANCE (광고 규정) ═══════════ */}
      <ComplianceSection no={nextNo()} />

      {/* ═══════════ FAQ ═══════════ */}
      <FaqSection no={nextNo()} />

      {/* ═══════════ APPLY (신청 폼) ═══════════ */}
      <LeadForm no={nextNo()} selectedPackage={selectedPackage} />

      {/* 카카오톡 플로팅 버튼 (URL 없으면 숨김) */}
      <KakaoFloat />

      {/* ═══════════ 전용 푸터 ═══════════ */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <p className="font-display text-sm font-bold tracking-tight text-white">
            <span className="text-primary">UNTITLED</span>PRODUCTION
          </p>
          <p className="text-xs text-sub-text/60">
            © {new Date().getFullYear()} untitled-studio · 병원·변호사 유튜브 제작·운영
          </p>
        </div>
      </footer>
    </div>
  );
}

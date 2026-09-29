"use client";

import FadeInSection from "@/components/FadeInSection";

/**
 * /production — 유튜브 제작·운영 서비스 원페이지
 * 전용 헤더(ProductionHeader)의 앵커(#work #system #services #about #contact)와 연결.
 * ⚠️ 케이스/수치는 자리표시용 — 실제 내용으로 교체 필요.
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

/* ── 숫자 지표 (자리표시) ── */
const STATS = [
  { value: "N개사", label: "현재 파트너" },
  { value: "000,000", label: "운영 채널 누적 구독자" },
  { value: "0,000만+", label: "누적 영상 조회수" },
  { value: "2016—현재", label: "영상 제작 경력" },
];

/* ── 케이스 스터디 (자리표시) ── */
const CASES = [
  {
    client: "채널 A (교체 필요)",
    channel: "채널명",
    summary: "신규 런칭부터 월간 포맷 운영까지",
    growth: "구독자 0 → 000명",
    before: "채널 자산이 없는 상태에서 시작",
    action: "타깃 질문 기반 주제 선정, 롱폼·쇼츠 분리 운영",
    after: "신규 채널 기준 구독자 000명까지 성장",
  },
  {
    client: "채널 B (교체 필요)",
    channel: "채널명",
    summary: "기존 채널 리빌딩과 검색 유입 구조 재정비",
    growth: "구독자 000 → 0.0천명",
    before: "업로드는 있었지만 검색 유입과 전환 흐름이 약한 상태",
    action: "콘텐츠 주제 구조화, 시청자 질문 중심으로 재정비",
    after: "구독자 0.0천명 도달, 최고 조회수 00만회 기록",
  },
  {
    client: "채널 C (교체 필요)",
    channel: "채널명",
    summary: "장기 운영 기준 수립과 포맷 구조화",
    growth: "구독자 0.0천 → 00.0만",
    before: "영상은 있었지만 장기 운영 기준이 필요한 상태",
    action: "검색 질문·전문성·전환 안내를 연결하는 운영 설계",
    after: "구독자 00.0만 성장, 단일 영상 최고 000만회 기록",
  },
];

/* ── 운영 시스템 단계 ── */
const SYSTEM_STEPS = [
  {
    no: "01",
    title: "채널 진단 · 전략",
    desc: "채널의 현재 상태와 목표를 정리하고, 어떤 시청자에게 어떤 콘텐츠로 닿을지 방향을 세웁니다.",
  },
  {
    no: "02",
    title: "콘텐츠 기획",
    desc: "검색 질문과 시청자 관심사를 기반으로 월 단위 콘텐츠 주제를 설계합니다.",
  },
  {
    no: "03",
    title: "촬영 준비 · 촬영",
    desc: "대본 정리, 화법 코칭, 촬영 세팅까지. 출연자는 말하는 것에만 집중할 수 있게 합니다.",
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
    desc: "채널 진단과 콘텐츠 방향 설계. 직접 운영하실 팀을 위한 기준을 만들어 드립니다.",
    tag: "CONSULTING",
  },
];

export default function ProductionPage() {
  return (
    <div className="scroll-smooth bg-background">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        <FadeInSection>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            YouTube Production &amp; Channel Operation
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            영상을 만들고,
            <br />
            <span className="text-primary">채널이 움직이게</span> 합니다.
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-sub-text md:text-lg">
            한 편의 영상이 아니라 채널의 흐름을 만듭니다.
            <br />
            기획부터 촬영, 편집, 발행, 다음 달 운영 판단까지 — 한 팀이 맡습니다.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#contact"
              className="w-full rounded-xl bg-primary px-8 py-4 text-base font-bold text-background transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
            >
              제작 문의하기
            </a>
            <a
              href="#work"
              className="w-full rounded-xl border border-border px-8 py-4 text-base font-semibold text-white transition-all duration-200 hover:border-primary hover:text-primary sm:w-auto"
            >
              운영 사례 보기
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
              01 — WHAT WE DO
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-snug text-white md:text-4xl">
              잘 만든 영상과
              <br />
              꾸준히 움직이는 채널은 다릅니다.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-sub-text">
              영상 한 편을 예쁘게 만드는 일과 채널을 계속 성장시키는 일은 다른
              일입니다. 주제 선정, 출연, 촬영, 편집, 발행, 데이터가 같은 방향을
              보게 만드는 것 — 그게 저희가 하는 일입니다. 대표님은 본업에
              집중하시고, 매달 반복되는 운영 실무는 저희가 맡습니다.
            </p>
          </FadeInSection>

          {/* 숫자 지표 */}
          <FadeInSection delay={0.15}>
            <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {STATS.map((s) => (
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
        </div>
      </section>

      {/* ═══════════ SELECTED WORK ═══════════ */}
      <section id="work" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
              02 — SELECTED WORK
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
              결과만 보여드리지 않습니다.
              <br />
              무엇을 맡았는지 함께 보여드립니다.
            </h2>
          </FadeInSection>

          <div className="mt-14 space-y-6">
            {CASES.map((c, i) => (
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

      {/* ═══════════ SYSTEM ═══════════ */}
      <section id="system" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
              03 — SYSTEM
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
              04 — SERVICES
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

      {/* ═══════════ CONTACT ═══════════ */}
      <section id="contact" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
        <div className="mx-auto max-w-3xl text-center">
          <FadeInSection>
            <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
              05 — CONTACT
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
              채널 이야기,
              <br />
              편하게 시작해 보세요.
            </h2>
            <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-sub-text">
              지금 채널 상황과 목표를 알려주시면
              <br />
              어떤 방식이 맞을지 함께 정리해 드립니다.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="mailto:untitled.mooje@gmail.com"
                className="w-full rounded-xl bg-primary px-8 py-4 text-base font-bold text-background transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
              >
                메일로 문의하기
              </a>
              <a
                href="https://www.instagram.com/untitled______projects/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl border border-border px-8 py-4 text-base font-semibold text-white transition-all duration-200 hover:border-primary hover:text-primary sm:w-auto"
              >
                인스타그램 DM ↗
              </a>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══════════ 전용 푸터 ═══════════ */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <p className="font-display text-sm font-bold tracking-tight text-white">
            <span className="text-primary">UNTITLED</span>PRODUCTION
          </p>
          <p className="text-xs text-sub-text/60">
            © {new Date().getFullYear()} untitled-studio · 영상 제작 · 채널 운영
          </p>
        </div>
      </footer>
    </div>
  );
}

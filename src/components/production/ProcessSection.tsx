"use client";

import FadeInSection from "@/components/FadeInSection";

/**
 * 진행 방식 — 기획 진단부터 첫 업로드까지 4단계.
 * "원장님(변호사님)이 실제로 쓰시는 시간은 한 달에 반나절" 강조.
 */

const STEPS = [
  {
    no: "STEP 1",
    title: "기획 진단",
    time: "30분 · 온라인 또는 방문",
    desc: "지금 상황과 목표를 듣고, 찍을 주제와 첫 달 계획을 함께 정리합니다. 진단 리포트 1장을 드립니다.",
  },
  {
    no: "STEP 2",
    title: "기획안",
    time: "계약 후 1~2주",
    desc: "영상 주제 10개, 영상별 첫 10초와 전체 흐름까지 담긴 기획안을 드립니다. 의료·변호사 광고 규정도 이 단계에서 먼저 점검합니다.",
  },
  {
    no: "STEP 3",
    title: "몰아 찍기",
    time: "반나절 · 3~4편",
    desc: "하루 반나절에 3~4편을 한 번에 촬영합니다. 대본은 외우지 않으셔도 됩니다 — 키워드만 보고 평소 상담하듯 말씀하시면 됩니다.",
  },
  {
    no: "STEP 4",
    title: "편집 & 업로드",
    time: "월 4편 기준",
    desc: "편집, 제목, 썸네일, 자막까지 저희가 마무리하고 업로드합니다. 올라간 영상은 확인만 해주시면 됩니다.",
  },
];

export default function ProcessSection({ no }: { no: string }) {
  return (
    <section id="process" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <FadeInSection>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
            {no} — PROCESS
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
            진료와 사건은 그대로 보시고,
            <br />
            영상은 이렇게 진행됩니다.
          </h2>
        </FadeInSection>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <FadeInSection key={step.no} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-border bg-card p-7">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-sm font-bold text-primary">
                    {step.no}
                  </p>
                  <span className="text-xs text-sub-text/70">{step.time}</span>
                </div>
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

        <FadeInSection delay={0.3}>
          <div className="mt-10 rounded-2xl border border-primary/30 bg-primary/5 p-7 text-center">
            <p className="text-lg font-bold text-white md:text-xl">
              원장님·변호사님이 실제로 쓰시는 시간은{" "}
              <span className="text-primary">한 달에 반나절</span>이면 됩니다.
            </p>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}

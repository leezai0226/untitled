"use client";

import FadeInSection from "@/components/FadeInSection";

/**
 * 광고 규정 섹션 — "의료광고·변호사 광고 규정, 저희가 먼저 챙깁니다"
 */

const POINTS = [
  {
    title: "기획 단계에서 먼저 걸러냅니다",
    desc: "“최고”, “유일”, “100% 해결” 같은 과장·단정 표현은 대본이 되기 전에 기획 단계에서 걷어냅니다. 촬영한 뒤에 문제가 되는 일이 없도록 순서를 앞에 둡니다.",
  },
  {
    title: "사례는 누구인지 알 수 없게",
    desc: "환자·의뢰인 이야기를 다룰 때는 특정할 수 있는 정보를 바꾸고 각색하는 것을 원칙으로 합니다. 전문가의 신뢰는 지키면서, 보는 사람에게 필요한 내용만 남깁니다.",
  },
  {
    title: "치료 효과·결과를 단정하지 않습니다",
    desc: "“이 치료를 받으면 낫습니다” 대신 “이런 경우에 이런 선택지가 있습니다”로 말하는 방식을 함께 설계합니다. 그게 규정에도, 신뢰에도 맞는 방향입니다.",
  },
];

export default function ComplianceSection({ no }: { no: string }) {
  return (
    <section
      id="compliance"
      className="scroll-mt-24 border-t border-border/60 px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <FadeInSection>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
            {no} — COMPLIANCE
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
            의료광고·변호사 광고 규정,
            <br />
            저희가 먼저 챙깁니다.
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-sub-text">
            전문직 유튜브에서 가장 조심해야 하는 건 조회수가 아니라 표현입니다.
            규정을 아는 상태에서 기획하는 것과 모르고 찍는 것은 완전히 다릅니다.
          </p>
        </FadeInSection>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {POINTS.map((point, i) => (
            <FadeInSection key={point.title} delay={i * 0.1}>
              <div className="h-full rounded-2xl border border-border bg-card p-7">
                <h3 className="text-lg font-bold text-white">{point.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-sub-text">
                  {point.desc}
                </p>
              </div>
            </FadeInSection>
          ))}
        </div>

        <FadeInSection delay={0.3}>
          <p className="mt-8 text-xs leading-relaxed text-sub-text/60">
            * 최종 심의나 규정 판단은 원장님(변호사님) 소속 협회 기준을 따릅니다.
          </p>
        </FadeInSection>
      </div>
    </section>
  );
}

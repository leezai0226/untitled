"use client";

import FadeInSection from "@/components/FadeInSection";
import { pricing, packages } from "@/config/production";

/**
 * 가격 섹션 — 값은 전부 src/config/production.ts 에서 읽는다.
 * 가격이 비어 있으면 "상담 후 안내"로 표시.
 * 카드 하단 버튼 → 신청 폼으로 스크롤하면서 해당 상품이 미리 선택된다.
 */

export default function PricingSection({
  no,
  onSelectPackage,
}: {
  no: string;
  onSelectPackage: (packageName: string) => void;
}) {
  const priceOf = (key: keyof typeof pricing) => {
    const v = pricing[key];
    return typeof v === "string" && v.trim() ? v : "상담 후 안내";
  };

  const handleSelect = (name: string) => {
    onSelectPackage(name);
    document
      .getElementById("apply")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="pricing" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <FadeInSection>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
            {no} — PRICING
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
            필요한 만큼만,
            <br />
            투명하게 안내드립니다.
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-sub-text">
            처음이시라면 기획 진단부터 가볍게 시작하셔도 됩니다.
            진단만 받으시고 직접 운영하셔도 괜찮습니다.
          </p>
        </FadeInSection>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg, i) => {
            const price = priceOf(pkg.priceKey);
            return (
              <FadeInSection key={pkg.id} delay={i * 0.08}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border bg-card p-7 transition-all duration-300 hover:-translate-y-1 ${
                    pkg.recommended
                      ? "border-primary/60 shadow-lg shadow-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {pkg.recommended && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 font-display text-[10px] font-bold tracking-widest text-background">
                      추천
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
                  <p className="mt-1 text-sm text-sub-text">{pkg.summary}</p>
                  <p className="mt-4 font-display text-xl font-bold text-primary">
                    {price}
                  </p>
                  {pkg.id === "diagnosis" && pricing.diagnosisCredit.trim() && (
                    <p className="mt-1 text-xs text-sub-text">
                      {pricing.diagnosisCredit}
                    </p>
                  )}

                  <ul className="mt-5 flex-1 space-y-2">
                    {pkg.includes.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm leading-relaxed text-sub-text"
                      >
                        <span className="mt-0.5 flex-shrink-0 text-primary">✓</span>
                        {item}
                      </li>
                    ))}
                    {pkg.excludes.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm leading-relaxed text-sub-text/50"
                      >
                        <span className="mt-0.5 flex-shrink-0">✕</span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelect(pkg.name)}
                    className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      pkg.recommended
                        ? "bg-primary text-background hover:brightness-110"
                        : "border border-border text-white hover:border-primary hover:text-primary"
                    }`}
                  >
                    {pkg.id === "diagnosis" ? "진단 신청하기" : "이 구성으로 상담하기"}
                  </button>
                </div>
              </FadeInSection>
            );
          })}
        </div>

        {pricing.showVatNote && (
          <FadeInSection delay={0.3}>
            <p className="mt-6 text-center text-xs text-sub-text/60">
              {pricing.vatNote}
            </p>
          </FadeInSection>
        )}
      </div>
    </section>
  );
}

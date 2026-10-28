"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FadeInSection from "@/components/FadeInSection";
import { pricing } from "@/config/production";

/**
 * 자주 묻는 질문 — 아코디언.
 * 계약 기간은 config 의 minContractMonths 를 읽는다 (0이면 "상담 시 안내").
 */

function buildFaqs() {
  const contractAnswer =
    pricing.minContractMonths > 0
      ? `기본 계약 기간은 ${pricing.minContractMonths}개월입니다. 유튜브는 한두 달 만에 결과가 나오는 매체가 아니라서, 최소한의 호흡을 두고 함께 가는 것을 권해 드립니다. 자세한 조건은 상담에서 안내드립니다.`
      : "계약 기간은 상담에서 채널 상황과 목표에 맞춰 안내드립니다. 유튜브는 한두 달 만에 결과가 나오는 매체가 아니라서, 최소한의 호흡을 두고 함께 가는 것을 권해 드립니다.";

  return [
    {
      q: "얼굴이 꼭 나와야 하나요?",
      a: "꼭 그렇지는 않습니다. 다만 병원·법률 분야는 “누가 말하는가”가 신뢰에 큰 영향을 주기 때문에, 가능하다면 출연을 권해 드립니다. 얼굴 공개가 어려우시면 손·자료 화면 중심 구성 등 대안을 진단 단계에서 함께 찾습니다.",
    },
    {
      q: "촬영은 어디서 하나요?",
      a: "병원·사무실로 저희가 방문하는 것이 기본입니다. 진료실이나 상담실 배경이 오히려 신뢰를 줍니다. 원하시면 스튜디오 촬영도 가능합니다.",
    },
    {
      q: "대본은 누가 쓰나요?",
      a: "기획과 구성은 저희가 만듭니다. 다만 “읽는 대본”이 아니라 키워드 중심으로 정리해 드려서, 평소 환자분·의뢰인에게 설명하시듯 말씀하시면 됩니다. 외우실 필요가 없습니다.",
    },
    {
      q: "계약 기간은 어떻게 되나요?",
      a: contractAnswer,
    },
    {
      q: "이미 채널이 있는데, 중간부터 맡길 수 있나요?",
      a: "네, 가능합니다. 기존 채널의 영상과 데이터를 보고 무엇을 유지하고 무엇을 바꿀지 진단부터 시작합니다. 처음부터 다시 만드는 것보다 효율적인 경우가 많습니다.",
    },
    {
      q: "진단만 받아봐도 되나요?",
      a: "물론입니다. 기획 진단은 그 자체로 완결된 상품입니다. 진단 리포트를 받아보시고 직접 운영하셔도 되고, 필요하실 때 다시 찾아주셔도 됩니다.",
    },
  ];
}

export default function FaqSection({ no }: { no: string }) {
  const faqs = buildFaqs();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
      <div className="mx-auto max-w-3xl">
        <FadeInSection>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
            {no} — FAQ
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
            자주 묻는 질문
          </h2>
        </FadeInSection>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <FadeInSection key={faq.q} delay={i * 0.05}>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold text-white">
                      {faq.q}
                    </span>
                    <span
                      className={`flex-shrink-0 text-primary transition-transform duration-300 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="px-6 pb-6 text-sm leading-relaxed text-sub-text">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}

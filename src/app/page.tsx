"use client";

import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";

const values = [
  {
    icon: "🎯",
    title: "오늘 배워서 오늘 바로 업로드",
    desc: "긴 강의를 들을 시간조차 없는 분들! 프로그램 세팅부터 컷편집, 자막, 최종 출력까지. 단 하루 만에 첫 영상을 완성합니다.",
  },
  {
    icon: "✂️",
    title: "불필요한 기능은 과감히 버립니다",
    desc: "복잡한 이론 없이 바로 쓸 수 있는 실전 편집 워크플로우를 알려드립니다.",
  },
  {
    icon: "🚀",
    title: "초보티를 벗는 한 끗 차이",
    desc: "복잡한 효과 없이 기본 툴만으로도 영상의 시각적 퀄리티를 확 높여주는 텍스트 및 컬러 세팅 꿀팁을 전수합니다.",
  },
];

export default function HomePage() {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <FadeInSection className="relative z-10">
          <p className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
            Premiere Pro One-Day Class
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
            하루 만에 끝내는
            <br />
            <span className="text-primary">효율적인 편집</span> 배워보기!
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-sub-text leading-relaxed">
            평범한 일상을 영화로 만드는 <span className="font-bold text-primary">[브이로그반]</span>, 내 사업을 알리는 무기를 만드는 <span className="font-bold text-primary">[숏폼반]</span>
            <br />
            거창한 기획 없이도 훌륭한 결과물을 만들어내는 가장 효율적인 시스템을 경험해 보세요
          </p>
          <div className="mt-10">
            <Link
              href="/class"
              className="rounded-xl bg-primary px-8 py-4 font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25"
            >
              강의 자세히 보기
            </Link>
          </div>
        </FadeInSection>
      </section>

      {/* Value Proposition */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <FadeInSection>
          <h2 className="text-center text-3xl font-bold md:text-4xl">
            왜 <span className="text-primary">이 클래스</span>인가요?
          </h2>
        </FadeInSection>
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3 items-stretch">
          {values.map((item, i) => (
            <FadeInSection key={item.title} delay={i * 0.15} className="flex">
              <div className="flex flex-col group rounded-xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 w-full">
                <span className="text-4xl">{item.icon}</span>
                <h3 className="mt-4 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-sub-text leading-relaxed flex-1">{item.desc}</p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>
    </div>
  );
}

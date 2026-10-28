"use client";

import FadeInSection from "@/components/FadeInSection";
import { samples } from "@/config/production";

/**
 * 샘플 섹션 — config 의 samples 배열이 비어 있으면 섹션 자체를 렌더링하지 않는다.
 * demo 타입에는 반드시 "데모 영상" 배지를 표시 (실제 고객 사례처럼 보이면 안 됨).
 * 유튜브는 임베드 + 지연 로딩.
 */

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  pilot: { label: "파일럿", className: "bg-primary/10 text-primary" },
  demo: { label: "데모 영상", className: "bg-yellow-500/15 text-yellow-400" },
  plan: { label: "기획안 샘플", className: "bg-border text-sub-text" },
};

/** 유튜브 URL → 임베드 URL */
function toEmbedUrl(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function SamplesSection({ no }: { no: string }) {
  if (samples.length === 0) return null;

  return (
    <section id="samples" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <FadeInSection>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
            {no} — SAMPLES
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
            이런 톤으로 만듭니다.
          </h2>
        </FadeInSection>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {samples.map((sample, i) => {
            const badge = TYPE_BADGE[sample.type];
            const embedUrl = sample.youtubeUrl
              ? toEmbedUrl(sample.youtubeUrl)
              : null;
            return (
              <FadeInSection key={sample.title} delay={i * 0.1}>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  {embedUrl && (
                    <div className="aspect-video w-full">
                      <iframe
                        src={embedUrl}
                        title={sample.title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 font-display text-[10px] font-bold tracking-widest ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <h3 className="mt-3 text-lg font-bold text-white">
                      {sample.title}
                    </h3>
                    {sample.description && (
                      <p className="mt-2 text-sm leading-relaxed text-sub-text">
                        {sample.description}
                      </p>
                    )}
                    {sample.type === "plan" && sample.fileUrl && (
                      <a
                        href={sample.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                      >
                        기획안 보기 ↗
                      </a>
                    )}
                  </div>
                </div>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}

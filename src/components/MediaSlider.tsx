"use client";

/*
 * ──────────────────────────────────────────────────────────
 * MediaSlider — 상품 상세 페이지용 4:5 비율 사진/영상 슬라이더
 *
 * - 각 슬라이드는 aspect-[4/5] 고정 + object-cover
 * - 'video' 타입은 autoplay / loop / muted / playsinline 으로 재생
 * - Framer Motion 드래그 스와이프, 좌우 화살표, 페이지네이션(점) 제공
 * - items가 비어있거나 null이면 컴포넌트 자체가 렌더링되지 않음
 * ──────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

export interface SliderMediaItem {
  url: string;
  type: "image" | "video";
}

interface MediaSliderProps {
  items: SliderMediaItem[] | null | undefined;
  title?: string;
}

export default function MediaSlider({ items, title }: MediaSliderProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  /* 슬라이드 전환 시: 이전 영상은 일시정지, 현재 영상은 처음부터 재생 */
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (i === index) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [index]);

  /* 조건부 렌더링 — 데이터가 없으면 null (모든 훅 호출 이후에 early return) */
  if (!items || items.length === 0) return null;

  const total = items.length;
  const current = items[index];

  const paginate = (dir: number) => {
    setDirection(dir);
    setIndex((prev) => (prev + dir + total) % total);
  };

  const goTo = (next: number) => {
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      paginate(1);
    } else if (info.offset.x > threshold) {
      paginate(-1);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
      {/* ── 슬라이드 영역 (4:5 비율 고정) ── */}
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 260, damping: 32 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 h-full w-full"
          >
            {current.type === "video" ? (
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(index, el);
                  else videoRefs.current.delete(index);
                }}
                src={current.url}
                autoPlay
                loop
                muted
                playsInline
                controls={false}
                preload="metadata"
                className="h-full w-full object-cover pointer-events-none"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.url}
                alt={title ? `${title} 미디어 ${index + 1}` : `미디어 ${index + 1}`}
                draggable={false}
                className="h-full w-full object-cover pointer-events-none select-none"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── 좌우 화살표 (슬라이드 2개 이상일 때만) ── */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => paginate(-1)}
              aria-label="이전 슬라이드"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/60 p-2 text-white backdrop-blur-sm transition-all hover:bg-background/80 hover:scale-110"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => paginate(1)}
              aria-label="다음 슬라이드"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/60 p-2 text-white backdrop-blur-sm transition-all hover:bg-background/80 hover:scale-110"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </>
        )}

        {/* ── 현재 인덱스 배지 ── */}
        {total > 1 && (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-background/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {index + 1} / {total}
          </div>
        )}
      </div>

      {/* ── 하단 페이지네이션(점) ── */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-2 py-3">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 슬라이드로 이동`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-6 bg-primary"
                  : "w-2 bg-sub-text/40 hover:bg-sub-text/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

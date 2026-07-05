"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/* ─────────────── 타입 ─────────────── */

interface Lesson {
  id: string;
  title: string;
  duration_seconds: number;
  is_preview: boolean;
  vimeo_url: string;
  progress: { watched_seconds: number; completed: boolean } | null;
}

interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseInfo {
  id: string;
  title: string;
}

/* Vimeo Player SDK 타입 (최소한만) */
interface VimeoPlayer {
  on: (event: string, cb: (data: { seconds: number; duration: number }) => void) => void;
  setCurrentTime: (sec: number) => Promise<number>;
  destroy: () => Promise<void>;
}

declare global {
  interface Window {
    Vimeo?: {
      Player: new (el: HTMLElement | string, options: Record<string, unknown>) => VimeoPlayer;
    };
  }
}

/* ── Vimeo URL → embed 정보 추출 ──
 * https://vimeo.com/123456789            → id
 * https://vimeo.com/123456789/abcdef123  → id + 비공개 해시
 */
function parseVimeoUrl(url: string): { id: string; hash: string | null } | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!m) return null;
  return { id: m[1], hash: m[2] ?? null };
}

function formatDuration(sec: number): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ─────────────── 메인 ─────────────── */

function WatchPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const initialLessonId = searchParams.get("lesson");

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const playerRef = useRef<VimeoPlayer | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef(0);
  const currentLessonRef = useRef<Lesson | null>(null);
  currentLessonRef.current = currentLesson;

  /* ── 데이터 로드 ── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/course/watch?course_id=${courseId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setCourse(data.course);
        setChapters(data.chapters ?? []);
        setEnrolled(data.enrolled);

        const allLessons: Lesson[] = (data.chapters ?? []).flatMap(
          (ch: Chapter) => ch.lessons
        );

        // 초기 강의 선택: URL 파라미터 > 마지막 미완료 강의 > 첫 강의
        let target: Lesson | undefined;
        if (initialLessonId) {
          target = allLessons.find((l) => l.id === initialLessonId);
        }
        if (!target && data.enrolled) {
          target = allLessons.find((l) => !l.progress?.completed);
        }
        if (!target) {
          target = allLessons.find((l) => l.vimeo_url) ?? allLessons[0];
        }

        if (!data.enrolled && target && !target.is_preview) {
          alert("수강권이 필요한 강의입니다.");
          router.replace(`/course/${courseId}`);
          return;
        }

        setCurrentLesson(target ?? null);
      } catch {
        alert("강의 정보를 불러오지 못했습니다.");
        router.replace(`/course/${courseId}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId, initialLessonId, router]);

  /* ── 진도 저장 ── */
  const saveProgress = useCallback(
    async (seconds: number, duration: number) => {
      const lesson = currentLessonRef.current;
      if (!lesson) return;
      try {
        await fetch("/api/course/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lesson_id: lesson.id,
            watched_seconds: seconds,
            duration_seconds: Math.floor(duration),
          }),
        });
      } catch {
        // 진도 저장 실패는 조용히 무시
      }
    },
    []
  );

  /* ── Vimeo Player SDK 로드 + 플레이어 생성 ── */
  useEffect(() => {
    if (!currentLesson?.vimeo_url || !playerContainerRef.current) return;

    const parsed = parseVimeoUrl(currentLesson.vimeo_url);
    if (!parsed) return;

    let cancelled = false;

    const setupPlayer = () => {
      if (cancelled || !window.Vimeo || !playerContainerRef.current) return;

      // 기존 플레이어 제거
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
      playerContainerRef.current.innerHTML = "";

      const options: Record<string, unknown> = {
        id: Number(parsed.id),
        responsive: true,
      };
      if (parsed.hash) options.h = parsed.hash;

      const player = new window.Vimeo.Player(playerContainerRef.current, options);
      playerRef.current = player;

      // 이어보기: 저장된 진도 위치로 이동
      const resume = currentLesson.progress?.watched_seconds ?? 0;
      if (resume > 5 && !currentLesson.progress?.completed) {
        player.setCurrentTime(resume).catch(() => {});
      }

      // 10초마다 진도 저장
      player.on("timeupdate", (data) => {
        if (data.seconds - lastSavedRef.current >= 10) {
          lastSavedRef.current = data.seconds;
          saveProgress(data.seconds, data.duration);
        }
      });
      player.on("pause", (data) => {
        saveProgress(data.seconds, data.duration);
      });
      player.on("ended", (data) => {
        saveProgress(data.duration, data.duration);
      });
    };

    if (window.Vimeo) {
      setupPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://player.vimeo.com/api/player.js";
      script.onload = setupPlayer;
      document.body.appendChild(script);
    }

    lastSavedRef.current = 0;

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson?.id]);

  /* ── 강의 선택 ── */
  const selectLesson = (lesson: Lesson) => {
    if (!enrolled && !lesson.is_preview) {
      alert("수강권이 필요한 강의입니다.");
      return;
    }
    if (!lesson.vimeo_url) {
      alert("영상이 아직 등록되지 않았습니다.");
      return;
    }
    setCurrentLesson(lesson);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-20">
        <p className="text-sub-text">불러오는 중...</p>
      </div>
    );
  }

  const totalLessons = chapters.reduce((s, ch) => s + ch.lessons.length, 0);
  const completedCount = chapters.reduce(
    (s, ch) => s + ch.lessons.filter((l) => l.progress?.completed).length,
    0
  );

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* 상단 바 */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="min-w-0">
            <button
              onClick={() => router.push(`/course/${courseId}`)}
              className="text-xs text-sub-text hover:text-primary transition-colors"
            >
              ← 강좌 소개로
            </button>
            <h1 className="text-lg font-bold text-white truncate">
              {course?.title}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {enrolled && totalLessons > 0 && (
              <span className="text-xs text-sub-text whitespace-nowrap">
                진도{" "}
                <span className="text-primary font-semibold">
                  {completedCount}/{totalLessons}
                </span>
              </span>
            )}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:border-primary/50 hover:text-white transition-colors lg:hidden"
            >
              {sidebarOpen ? "목록 닫기" : "목록 열기"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* ── 플레이어 영역 ── */}
          <div className="flex-1 min-w-0">
            <div className="overflow-hidden rounded-2xl border border-border bg-black">
              {currentLesson?.vimeo_url ? (
                <div ref={playerContainerRef} className="w-full" />
              ) : (
                <div className="flex aspect-video items-center justify-center">
                  <p className="text-sm text-sub-text">
                    시청할 강의를 선택해 주세요.
                  </p>
                </div>
              )}
            </div>
            {currentLesson && (
              <div className="mt-4 px-1">
                <h2 className="text-base font-bold text-white">
                  {currentLesson.title}
                </h2>
                {currentLesson.progress?.completed && (
                  <p className="mt-1 text-xs text-green-400">✅ 수강 완료</p>
                )}
              </div>
            )}
          </div>

          {/* ── 커리큘럼 사이드바 ── */}
          <aside
            className={`w-full lg:w-80 flex-shrink-0 ${sidebarOpen ? "" : "hidden lg:block"}`}
          >
            <div className="rounded-2xl border border-border bg-card overflow-hidden max-h-[70vh] overflow-y-auto">
              {chapters.map((chapter, chIdx) => (
                <div key={chapter.id}>
                  <div className="sticky top-0 border-b border-border bg-card px-4 py-3">
                    <p className="text-xs font-bold text-sub-text uppercase tracking-wider">
                      CH {chIdx + 1} · {chapter.title}
                    </p>
                  </div>
                  {chapter.lessons.map((lesson) => {
                    const isActive = currentLesson?.id === lesson.id;
                    const locked = !enrolled && !lesson.is_preview;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => selectLesson(lesson)}
                        disabled={locked}
                        className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors border-b border-border/30 ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : locked
                              ? "text-sub-text/40 cursor-not-allowed"
                              : "text-white hover:bg-background/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="flex-shrink-0 text-xs">
                            {lesson.progress?.completed
                              ? "✅"
                              : locked
                                ? "🔒"
                                : isActive
                                  ? "▶️"
                                  : "·"}
                          </span>
                          <span className="truncate">{lesson.title}</span>
                        </span>
                        <span className="text-[11px] text-sub-text flex-shrink-0">
                          {formatDuration(lesson.duration_seconds)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {totalLessons === 0 && (
                <p className="p-6 text-center text-sm text-sub-text">
                  강의 준비 중입니다.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background pt-20">
          <p className="text-sub-text">불러오는 중...</p>
        </div>
      }
    >
      <WatchPageInner />
    </Suspense>
  );
}

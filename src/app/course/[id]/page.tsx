"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import FadeInSection from "@/components/FadeInSection";

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
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_active: boolean;
}

function formatDuration(sec: number): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCourse = useCallback(async () => {
    try {
      const res = await fetch(`/api/course/watch?course_id=${courseId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCourse(data.course);
      setChapters(data.chapters ?? []);
      setEnrolled(data.enrolled);
      setExpiresAt(data.expiresAt);
      setLoggedIn(data.loggedIn);
    } catch {
      alert("강좌 정보를 불러오지 못했습니다.");
      router.replace("/course");
    } finally {
      setLoading(false);
    }
  }, [courseId, router]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-20">
        <p className="text-sub-text">불러오는 중...</p>
      </div>
    );
  }

  if (!course) return null;

  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const completedLessons = chapters.reduce(
    (sum, ch) => sum + ch.lessons.filter((l) => l.progress?.completed).length,
    0
  );

  const handlePurchase = () => {
    if (!loggedIn) {
      alert("온라인 강의는 로그인 후 구매하실 수 있습니다.");
      router.push(`/login?redirect=/course/${courseId}`);
      return;
    }
    router.push(`/course/checkout?course_id=${courseId}`);
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="mx-auto max-w-4xl px-6 py-12">

        {/* ── 강좌 헤더 ── */}
        <FadeInSection>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative aspect-video w-full bg-background">
              {course.thumbnail_url ? (
                <Image
                  src={course.thumbnail_url}
                  alt={course.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-6xl">
                  🎬
                </div>
              )}
            </div>
            <div className="p-7">
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                {course.title}
              </h1>
              {course.description && (
                <p className="mt-4 text-base text-sub-text leading-relaxed whitespace-pre-line">
                  {course.description}
                </p>
              )}

              {/* 구매 / 수강 버튼 */}
              <div className="mt-8">
                {enrolled ? (
                  <div>
                    <button
                      onClick={() => router.push(`/course/${courseId}/watch`)}
                      className="w-full rounded-xl bg-primary px-6 py-4 text-base font-bold text-background transition-all hover:brightness-110 sm:w-auto sm:px-12"
                    >
                      {completedLessons > 0 ? "이어서 수강하기 →" : "수강 시작하기 →"}
                    </button>
                    <p className="mt-3 text-xs text-sub-text">
                      수강 기한:{" "}
                      {expiresAt
                        ? new Date(expiresAt).toLocaleDateString("ko-KR")
                        : "-"}{" "}
                      까지
                      {totalLessons > 0 && (
                        <span className="ml-2 text-primary">
                          · 진도 {completedLessons}/{totalLessons}
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-display text-3xl font-bold text-primary">
                      ₩{course.price.toLocaleString("ko-KR")}
                    </p>
                    <button
                      onClick={handlePurchase}
                      className="mt-4 w-full rounded-xl bg-primary px-6 py-4 text-base font-bold text-background transition-all hover:brightness-110 sm:w-auto sm:px-12"
                    >
                      수강 신청하기
                    </button>
                    <p className="mt-3 text-xs text-sub-text">
                      구매일로부터 1년간 무제한 수강 · 회원 전용
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* ── 커리큘럼 ── */}
        <FadeInSection delay={0.15}>
          <div className="mt-10">
            <h2 className="text-xl font-bold text-white">커리큘럼</h2>
            <p className="mt-1 text-sm text-sub-text">
              총 {chapters.length}개 챕터 · {totalLessons}개 강의
            </p>

            <div className="mt-6 space-y-4">
              {chapters.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-sub-text">
                  커리큘럼 준비 중입니다.
                </p>
              ) : (
                chapters.map((chapter, chIdx) => (
                  <div
                    key={chapter.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="border-b border-border px-6 py-4">
                      <p className="text-sm font-bold text-white">
                        <span className="text-primary mr-2">
                          CH {chIdx + 1}
                        </span>
                        {chapter.title}
                      </p>
                    </div>
                    <div>
                      {chapter.lessons.map((lesson, lsIdx) => (
                        <div
                          key={lesson.id}
                          className={`flex items-center justify-between px-6 py-3.5 text-sm ${
                            lsIdx < chapter.lessons.length - 1
                              ? "border-b border-border/40"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sub-text flex-shrink-0">
                              {lesson.progress?.completed
                                ? "✅"
                                : enrolled || lesson.is_preview
                                  ? "▶️"
                                  : "🔒"}
                            </span>
                            <span className="text-white truncate">
                              {lesson.title}
                            </span>
                            {lesson.is_preview && !enrolled && (
                              <button
                                onClick={() =>
                                  router.push(`/course/${courseId}/watch?lesson=${lesson.id}`)
                                }
                                className="flex-shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/25 transition-colors"
                              >
                                맛보기
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-sub-text flex-shrink-0 ml-3">
                            {formatDuration(lesson.duration_seconds)}
                          </span>
                        </div>
                      ))}
                      {chapter.lessons.length === 0 && (
                        <p className="px-6 py-4 text-xs text-sub-text">
                          강의 준비 중
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </FadeInSection>
      </div>
    </div>
  );
}

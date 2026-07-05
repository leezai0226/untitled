"use client";

import { useEffect, useState, useCallback } from "react";

/* ─────────────── 타입 ─────────────── */

interface LessonRow {
  id: string;
  chapter_id: string;
  title: string;
  vimeo_url: string;
  duration_seconds: number;
  is_preview: boolean;
  sort_order: number;
}

interface ChapterRow {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  course_lessons: LessonRow[];
}

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
  course_chapters: ChapterRow[];
}

/* ─────────────── 페이지 ─────────────── */

export default function AdminCoursePage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  // 강좌 추가/수정 폼
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    price: "",
  });

  // 챕터 추가
  const [newChapterTitle, setNewChapterTitle] = useState<Record<string, string>>({});

  // 강의 추가/수정
  const [lessonFormChapter, setLessonFormChapter] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    vimeo_url: "",
    duration_min: "",
    is_preview: false,
  });

  const [saving, setSaving] = useState(false);

  /* ── 데이터 로드 ── */
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/courses");
      const data = await res.json();
      if (res.ok) setCourses(data.courses ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  /* ── 공통 API 헬퍼 ── */
  const api = async (
    method: "POST" | "PUT" | "DELETE",
    body: Record<string, unknown>
  ) => {
    const res = await fetch("/api/admin/courses", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "요청 실패");
      return false;
    }
    return true;
  };

  /* ── 강좌 CRUD ── */
  const openCourseForm = (course?: CourseRow) => {
    if (course) {
      setEditingCourseId(course.id);
      setCourseForm({
        title: course.title,
        description: course.description ?? "",
        thumbnail_url: course.thumbnail_url ?? "",
        price: String(course.price),
      });
    } else {
      setEditingCourseId(null);
      setCourseForm({ title: "", description: "", thumbnail_url: "", price: "" });
    }
    setShowCourseForm(true);
  };

  const submitCourse = async () => {
    if (!courseForm.title.trim()) return alert("강좌 제목을 입력해 주세요.");
    setSaving(true);
    const payload: Record<string, unknown> = {
      resource: "course",
      title: courseForm.title,
      description: courseForm.description,
      thumbnail_url: courseForm.thumbnail_url,
      price: Number(courseForm.price) || 0,
    };
    let ok: boolean;
    if (editingCourseId) {
      ok = await api("PUT", { ...payload, id: editingCourseId });
    } else {
      ok = await api("POST", payload);
    }
    setSaving(false);
    if (ok) {
      setShowCourseForm(false);
      fetchCourses();
    }
  };

  const toggleCourseActive = async (course: CourseRow) => {
    if (await api("PUT", { resource: "course", id: course.id, is_active: !course.is_active })) {
      fetchCourses();
    }
  };

  const deleteCourse = async (course: CourseRow) => {
    if (!confirm(`"${course.title}" 강좌를 삭제할까요?\n챕터/강의도 모두 삭제됩니다.`)) return;
    if (await api("DELETE", { resource: "course", id: course.id })) fetchCourses();
  };

  /* ── 챕터 CRUD ── */
  const addChapter = async (courseId: string) => {
    const title = (newChapterTitle[courseId] ?? "").trim();
    if (!title) return alert("챕터 제목을 입력해 주세요.");
    if (await api("POST", { resource: "chapter", course_id: courseId, title })) {
      setNewChapterTitle((prev) => ({ ...prev, [courseId]: "" }));
      fetchCourses();
    }
  };

  const renameChapter = async (chapter: ChapterRow) => {
    const title = prompt("챕터 제목 수정", chapter.title);
    if (!title?.trim()) return;
    if (await api("PUT", { resource: "chapter", id: chapter.id, title: title.trim() })) {
      fetchCourses();
    }
  };

  const deleteChapter = async (chapter: ChapterRow) => {
    if (!confirm(`"${chapter.title}" 챕터를 삭제할까요?\n포함된 강의도 모두 삭제됩니다.`)) return;
    if (await api("DELETE", { resource: "chapter", id: chapter.id })) fetchCourses();
  };

  const moveChapter = async (course: CourseRow, index: number, dir: -1 | 1) => {
    const chapters = [...course.course_chapters];
    const target = index + dir;
    if (target < 0 || target >= chapters.length) return;
    [chapters[index], chapters[target]] = [chapters[target], chapters[index]];
    const orders = chapters.map((ch, i) => ({ id: ch.id, sort_order: i + 1 }));
    if (await api("PUT", { resource: "chapter", orders })) fetchCourses();
  };

  /* ── 강의 CRUD ── */
  const openLessonForm = (chapterId: string, lesson?: LessonRow) => {
    setLessonFormChapter(chapterId);
    if (lesson) {
      setEditingLessonId(lesson.id);
      setLessonForm({
        title: lesson.title,
        vimeo_url: lesson.vimeo_url,
        duration_min: lesson.duration_seconds
          ? String(Math.round(lesson.duration_seconds / 60))
          : "",
        is_preview: lesson.is_preview,
      });
    } else {
      setEditingLessonId(null);
      setLessonForm({ title: "", vimeo_url: "", duration_min: "", is_preview: false });
    }
  };

  const submitLesson = async () => {
    if (!lessonForm.title.trim()) return alert("강의 제목을 입력해 주세요.");
    setSaving(true);
    const payload: Record<string, unknown> = {
      resource: "lesson",
      title: lessonForm.title,
      vimeo_url: lessonForm.vimeo_url,
      duration_seconds: Math.round((Number(lessonForm.duration_min) || 0) * 60),
      is_preview: lessonForm.is_preview,
    };
    let ok: boolean;
    if (editingLessonId) {
      ok = await api("PUT", { ...payload, id: editingLessonId });
    } else {
      ok = await api("POST", { ...payload, chapter_id: lessonFormChapter });
    }
    setSaving(false);
    if (ok) {
      setLessonFormChapter(null);
      setEditingLessonId(null);
      fetchCourses();
    }
  };

  const deleteLesson = async (lesson: LessonRow) => {
    if (!confirm(`"${lesson.title}" 강의를 삭제할까요?`)) return;
    if (await api("DELETE", { resource: "lesson", id: lesson.id })) fetchCourses();
  };

  const moveLesson = async (chapter: ChapterRow, index: number, dir: -1 | 1) => {
    const lessons = [...chapter.course_lessons];
    const target = index + dir;
    if (target < 0 || target >= lessons.length) return;
    [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
    const orders = lessons.map((l, i) => ({ id: l.id, sort_order: i + 1 }));
    if (await api("PUT", { resource: "lesson", orders })) fetchCourses();
  };

  /* ─────────────── 렌더링 ─────────────── */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <p className="text-sub-text">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              🎬 온라인 강의 <span className="text-primary">관리</span>
            </h1>
            <p className="mt-2 text-sm text-sub-text">
              강좌 → 챕터 → 강의 순으로 등록하세요. 비활성 강좌는 노출되지 않습니다.
            </p>
          </div>
          <button
            onClick={() => openCourseForm()}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background transition-all hover:brightness-110 whitespace-nowrap"
          >
            + 강좌 추가
          </button>
        </div>

        {/* ── 강좌 추가/수정 폼 ── */}
        {showCourseForm && (
          <div className="mt-8 rounded-2xl border border-primary/40 bg-card p-6">
            <h2 className="text-lg font-bold text-white">
              {editingCourseId ? "강좌 수정" : "새 강좌"}
            </h2>
            <div className="mt-4 space-y-4">
              <input
                type="text"
                value={courseForm.title}
                onChange={(e) => setCourseForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="강좌 제목 *"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />
              <textarea
                value={courseForm.description}
                onChange={(e) => setCourseForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="강좌 소개"
                rows={4}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none resize-none"
              />
              <input
                type="text"
                value={courseForm.thumbnail_url}
                onChange={(e) => setCourseForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
                placeholder="썸네일 이미지 URL (선택)"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />
              <input
                type="number"
                value={courseForm.price}
                onChange={(e) => setCourseForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="가격 (원) *"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={submitCourse}
                  disabled={saving}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-background hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : editingCourseId ? "수정 저장" : "강좌 생성"}
                </button>
                <button
                  onClick={() => setShowCourseForm(false)}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm text-sub-text hover:text-white"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 강좌 목록 ── */}
        <div className="mt-8 space-y-4">
          {courses.length === 0 && !showCourseForm && (
            <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-sub-text">
              등록된 강좌가 없습니다. &quot;+ 강좌 추가&quot;로 시작하세요.
            </p>
          )}

          {courses.map((course) => {
            const isExpanded = expandedCourse === course.id;
            const totalLessons = course.course_chapters.reduce(
              (s, ch) => s + ch.course_lessons.length,
              0
            );
            return (
              <div
                key={course.id}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* 강좌 헤더 */}
                <div className="flex items-center justify-between gap-3 px-6 py-4">
                  <button
                    onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white truncate">{course.title}</p>
                      {!course.is_active && (
                        <span className="flex-shrink-0 rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                          비공개
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-sub-text">
                      ₩{course.price.toLocaleString("ko-KR")} · 챕터{" "}
                      {course.course_chapters.length} · 강의 {totalLessons} ·{" "}
                      {isExpanded ? "접기 ▲" : "펼치기 ▼"}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* 활성 토글 */}
                    <button
                      onClick={() => toggleCourseActive(course)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        course.is_active ? "bg-primary" : "bg-border"
                      }`}
                      title={course.is_active ? "공개 중" : "비공개"}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          course.is_active ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openCourseForm(course)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:text-white hover:border-primary/50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deleteCourse(course)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:text-red-400 hover:border-red-400/50"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* ── 펼침: 챕터/강의 관리 ── */}
                {isExpanded && (
                  <div className="border-t border-border bg-background/40 px-6 py-5 space-y-5">
                    {course.course_chapters.map((chapter, chIdx) => (
                      <div
                        key={chapter.id}
                        className="rounded-xl border border-border bg-card overflow-hidden"
                      >
                        {/* 챕터 헤더 */}
                        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex flex-col flex-shrink-0">
                              <button
                                onClick={() => moveChapter(course, chIdx, -1)}
                                className="text-[10px] text-sub-text hover:text-primary leading-none"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveChapter(course, chIdx, 1)}
                                className="text-[10px] text-sub-text hover:text-primary leading-none"
                              >
                                ▼
                              </button>
                            </div>
                            <p className="text-sm font-bold text-white truncate">
                              <span className="text-primary mr-1.5">CH {chIdx + 1}</span>
                              {chapter.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => openLessonForm(chapter.id)}
                              className="rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25"
                            >
                              + 강의
                            </button>
                            <button
                              onClick={() => renameChapter(chapter)}
                              className="rounded-md border border-border px-2.5 py-1 text-[11px] text-sub-text hover:text-white"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => deleteChapter(chapter)}
                              className="rounded-md border border-border px-2.5 py-1 text-[11px] text-sub-text hover:text-red-400"
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        {/* 강의 목록 */}
                        {chapter.course_lessons.map((lesson, lsIdx) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between gap-2 border-b border-border/30 px-4 py-2.5 last:border-b-0"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex flex-col flex-shrink-0">
                                <button
                                  onClick={() => moveLesson(chapter, lsIdx, -1)}
                                  className="text-[10px] text-sub-text hover:text-primary leading-none"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={() => moveLesson(chapter, lsIdx, 1)}
                                  className="text-[10px] text-sub-text hover:text-primary leading-none"
                                >
                                  ▼
                                </button>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white truncate">
                                  {lesson.title}
                                  {lesson.is_preview && (
                                    <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                      맛보기
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-sub-text truncate">
                                  {lesson.vimeo_url || "⚠️ 영상 미등록"}
                                  {lesson.duration_seconds > 0 &&
                                    ` · ${Math.round(lesson.duration_seconds / 60)}분`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => openLessonForm(chapter.id, lesson)}
                                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-sub-text hover:text-white"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => deleteLesson(lesson)}
                                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-sub-text hover:text-red-400"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* 강의 추가/수정 폼 */}
                        {lessonFormChapter === chapter.id && (
                          <div className="border-t border-primary/30 bg-background/60 p-4 space-y-3">
                            <p className="text-xs font-bold text-primary">
                              {editingLessonId ? "강의 수정" : "새 강의 추가"}
                            </p>
                            <input
                              type="text"
                              value={lessonForm.title}
                              onChange={(e) =>
                                setLessonForm((p) => ({ ...p, title: e.target.value }))
                              }
                              placeholder="강의 제목 *"
                              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                            />
                            <input
                              type="text"
                              value={lessonForm.vimeo_url}
                              onChange={(e) =>
                                setLessonForm((p) => ({ ...p, vimeo_url: e.target.value }))
                              }
                              placeholder="Vimeo 링크 (예: https://vimeo.com/123456789)"
                              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                            />
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                value={lessonForm.duration_min}
                                onChange={(e) =>
                                  setLessonForm((p) => ({ ...p, duration_min: e.target.value }))
                                }
                                placeholder="길이(분)"
                                className="w-28 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                              />
                              <label className="flex items-center gap-2 text-sm text-sub-text cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={lessonForm.is_preview}
                                  onChange={(e) =>
                                    setLessonForm((p) => ({ ...p, is_preview: e.target.checked }))
                                  }
                                  className="accent-[#c8a2ff]"
                                />
                                맛보기 공개 (비구매자도 시청 가능)
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={submitLesson}
                                disabled={saving}
                                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-background hover:brightness-110 disabled:opacity-50"
                              >
                                {saving ? "저장 중..." : "저장"}
                              </button>
                              <button
                                onClick={() => {
                                  setLessonFormChapter(null);
                                  setEditingLessonId(null);
                                }}
                                className="rounded-lg border border-border px-4 py-2 text-xs text-sub-text hover:text-white"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 챕터 추가 */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newChapterTitle[course.id] ?? ""}
                        onChange={(e) =>
                          setNewChapterTitle((prev) => ({
                            ...prev,
                            [course.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && addChapter(course.id)}
                        placeholder="새 챕터 제목"
                        className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                      />
                      <button
                        onClick={() => addChapter(course.id)}
                        className="rounded-xl bg-primary/15 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/25 whitespace-nowrap"
                      >
                        + 챕터 추가
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

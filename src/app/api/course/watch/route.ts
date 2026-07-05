import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createRateLimiter } from "@/utils/rateLimit";

/**
 * GET /api/course/watch?course_id=...
 *
 * 강좌 커리큘럼 + 영상 URL을 반환합니다.
 * - 수강권(유효기간 내)이 있는 회원: 모든 강의의 vimeo_url 포함
 * - 그 외: 맛보기(is_preview) 강의만 vimeo_url 포함, 나머지는 빈 문자열
 * - 진도(progress)도 함께 반환 (로그인 회원만)
 */

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });

export async function GET(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  if (!courseId) {
    return NextResponse.json({ error: "course_id가 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  /* ── 강좌 + 커리큘럼 조회 ── */
  const { data: course, error } = await adminClient
    .from("courses")
    .select("id, title, description, thumbnail_url, price, is_active, course_chapters(id, title, sort_order, course_lessons(id, title, vimeo_url, duration_seconds, is_preview, sort_order))")
    .eq("id", courseId)
    .single();

  if (error || !course) {
    return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  }

  /* ── 수강권 확인 ── */
  let enrolled = false;
  let expiresAt: string | null = null;

  if (user) {
    const { data: enrollment } = await adminClient
      .from("course_enrollments")
      .select("expires_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrollment && new Date(enrollment.expires_at) > new Date()) {
      enrolled = true;
      expiresAt = enrollment.expires_at;
    }
  }

  /* ── 진도 조회 (회원만) ── */
  const progressMap: Record<string, { watched_seconds: number; completed: boolean }> = {};
  if (user) {
    const { data: progress } = await adminClient
      .from("course_lesson_progress")
      .select("lesson_id, watched_seconds, completed")
      .eq("user_id", user.id);
    for (const p of progress ?? []) {
      progressMap[p.lesson_id] = {
        watched_seconds: p.watched_seconds,
        completed: p.completed,
      };
    }
  }

  /* ── 응답 구성: 미수강자는 맛보기 외 vimeo_url 제거 ── */
  type LessonRow = {
    id: string;
    title: string;
    vimeo_url: string;
    duration_seconds: number;
    is_preview: boolean;
    sort_order: number;
  };
  type ChapterRow = {
    id: string;
    title: string;
    sort_order: number;
    course_lessons: LessonRow[];
  };

  const chapters = ((course.course_chapters as ChapterRow[]) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ch) => ({
      id: ch.id,
      title: ch.title,
      lessons: (ch.course_lessons ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({
          id: l.id,
          title: l.title,
          duration_seconds: l.duration_seconds,
          is_preview: l.is_preview,
          vimeo_url: enrolled || l.is_preview ? l.vimeo_url : "",
          progress: progressMap[l.id] ?? null,
        })),
    }));

  return NextResponse.json({
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail_url: course.thumbnail_url,
      price: course.price,
      is_active: course.is_active,
    },
    chapters,
    enrolled,
    expiresAt,
    loggedIn: !!user,
  });
}

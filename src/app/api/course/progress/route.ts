import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createRateLimiter } from "@/utils/rateLimit";

/**
 * POST /api/course/progress
 *
 * 강의 시청 진도를 저장합니다. (회원 전용)
 * body: { lesson_id, watched_seconds, duration_seconds }
 * watched_seconds가 duration의 90% 이상이면 completed 처리합니다.
 */

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 120 });

export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { lesson_id, watched_seconds, duration_seconds } = await request.json();

  if (!lesson_id || typeof watched_seconds !== "number") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const duration = Number(duration_seconds) || 0;
  const watched = Math.max(0, Math.floor(watched_seconds));
  const completed = duration > 0 && watched >= duration * 0.9;

  // 기존 진도보다 뒤로 가면 덮어쓰지 않음 (최대값 유지)
  const { data: existing } = await adminClient
    .from("course_lesson_progress")
    .select("watched_seconds, completed")
    .eq("user_id", user.id)
    .eq("lesson_id", lesson_id)
    .maybeSingle();

  const finalWatched = Math.max(watched, existing?.watched_seconds ?? 0);
  const finalCompleted = completed || (existing?.completed ?? false);

  const { error } = await adminClient.from("course_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id,
      watched_seconds: finalWatched,
      duration_seconds: duration,
      completed: finalCompleted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, completed: finalCompleted });
}

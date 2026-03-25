import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

/* ── PUT: 시간대별 잔여 좌석 수정 ── */
export async function PUT(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id, remaining_seats } = body;

  if (!id) {
    return NextResponse.json(
      { error: "스케줄 ID가 필요합니다." },
      { status: 400 }
    );
  }

  const seats = Number(remaining_seats);
  if (isNaN(seats) || seats < 0) {
    return NextResponse.json(
      { error: "잔여 좌석은 0 이상 숫자여야 합니다." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("class_schedules")
    .update({ remaining_seats: seats })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `수정 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

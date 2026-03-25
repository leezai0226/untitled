import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";

// 관리자 주문 API: 1분에 30회 제한
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

/* ── PUT: 주문 상태 변경 (입금 확인 등) ── */
export async function PUT(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json(
      { error: "주문 ID와 상태값이 필요합니다." },
      { status: 400 }
    );
  }

  // 허용된 상태값만 허용 (임의 값 주입 방지)
  const allowedStatuses = ["pending", "completed", "cancelled"];
  if (!allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: "허용되지 않은 상태값입니다." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.paid_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `주문 상태 변경 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

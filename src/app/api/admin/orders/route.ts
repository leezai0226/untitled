import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

/* ── GET: 전체 주문 조회 (Service Role) ── */
export async function GET(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await adminClient
    .from("orders")
    .select("*")
    .neq("status", "hidden")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}

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

/* ── DELETE: 주문 숨김 처리 (Soft Delete) ── */
export async function DELETE(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json(
      { error: "주문 ID가 필요합니다." },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

  const { error } = await adminClient
    .from("orders")
    .update({ status: "hidden" })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `주문 숨김 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

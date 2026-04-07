import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createRateLimiter } from "@/utils/rateLimit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

const PORTONE_API_KEY = process.env.PORTONE_API_KEY ?? "";
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET ?? "";

/* ── 포트원 V1 토큰 발급 ── */
async function getPortoneToken(): Promise<string> {
  const res = await fetch("https://api.iamport.kr/users/getToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imp_key: PORTONE_API_KEY,
      imp_secret: PORTONE_API_SECRET,
    }),
  });
  const data = await res.json();
  if (data.code !== 0 || !data.response?.access_token) {
    throw new Error("포트원 토큰 발급 실패");
  }
  return data.response.access_token;
}

/* ═══════════════════════════════════════════════
 * POST /api/refund
 *
 * 다운로드하지 않은 상품에 대해 환불 요청을 처리합니다.
 * - 다운로드 이력이 있으면 환불 불가
 * - 포트원 결제 건은 자동 환불, 무통장은 환불 요청 접수
 * ═══════════════════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;

    const { orderItemId } = await request.json();

    if (!orderItemId) {
      return NextResponse.json(
        { error: "주문 항목 ID가 필요합니다." },
        { status: 400 }
      );
    }

    /* ── 유저 인증 ── */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    /* ── 주문 항목 조회 ── */
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

    const { data: orderItem, error: itemError } = await adminClient
      .from("order_items")
      .select(`
        id,
        downloaded_at,
        price,
        order_id,
        order:orders!inner(
          id,
          user_id,
          status,
          payment_method,
          toss_payment_key,
          total_amount
        )
      `)
      .eq("id", orderItemId)
      .single();

    if (itemError || !orderItem) {
      return NextResponse.json(
        { error: "주문 항목을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const order = orderItem.order as unknown as {
      id: string;
      user_id: string;
      status: string;
      payment_method: string;
      toss_payment_key: string | null;
      total_amount: number;
    };

    /* ── 본인 확인 ── */
    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: "본인의 주문만 환불할 수 있습니다." },
        { status: 403 }
      );
    }

    /* ── 이미 환불된 주문 체크 ── */
    if (order.status === "refunded") {
      return NextResponse.json(
        { error: "이미 환불 처리된 주문입니다." },
        { status: 400 }
      );
    }

    /* ── 다운로드 여부 확인 — 다운로드 했으면 환불 불가 ── */
    if (orderItem.downloaded_at) {
      return NextResponse.json(
        { error: "다운로드한 상품은 환불이 불가합니다." },
        { status: 400 }
      );
    }

    /* ── 포트원 결제 건 자동 환불 ── */
    if (order.payment_method === "portone" && order.toss_payment_key) {
      const token = await getPortoneToken();
      const impUid = order.toss_payment_key;

      const cancelRes = await fetch("https://api.iamport.kr/payments/cancel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imp_uid: impUid,
          reason: "고객 요청 환불",
          amount: orderItem.price,
        }),
      });

      const cancelData = await cancelRes.json();

      if (cancelData.code !== 0) {
        console.error("[포트원 환불 실패]", cancelData.message);
        return NextResponse.json(
          { error: "환불 처리에 실패했습니다. 관리자에게 문의해 주세요." },
          { status: 500 }
        );
      }
    }

    /* ── 주문 상태 업데이트 ── */
    await adminClient
      .from("orders")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return NextResponse.json({
      success: true,
      message:
        order.payment_method === "portone"
          ? "환불이 완료되었습니다. 카드사에 따라 2~5영업일 내 환불됩니다."
          : "환불 요청이 접수되었습니다. 관리자 확인 후 환불 처리됩니다.",
    });
  } catch (err: unknown) {
    console.error("POST /api/refund 에러:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "서버 내부 오류" },
      { status: 500 }
    );
  }
}

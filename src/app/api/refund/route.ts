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

/* ── 한국 시간 기준 날짜 차이(일) 계산 ── */
function getDaysUntilClass(scheduleDateStr: string): number {
  // 현재 한국 시간
  const nowKST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  nowKST.setHours(0, 0, 0, 0);

  // schedule_label에서 날짜 추출: "4/21 (화) 13:00 - 18:00" -> 4/21
  const dateMatch = scheduleDateStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (!dateMatch) return -1;

  const month = parseInt(dateMatch[1], 10);
  const day = parseInt(dateMatch[2], 10);

  // 올해 기준, 만약 이미 지났으면 내년
  let classDate = new Date(nowKST.getFullYear(), month - 1, day);
  classDate.setHours(0, 0, 0, 0);

  if (classDate.getTime() < nowKST.getTime() - 86400000 * 30) {
    // 30일 이상 과거면 내년으로 간주
    classDate = new Date(nowKST.getFullYear() + 1, month - 1, day);
    classDate.setHours(0, 0, 0, 0);
  }

  const diffMs = classDate.getTime() - nowKST.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/* ── 클래스 환불 정책 계산 ── */
function getClassRefundPolicy(daysUntil: number): {
  canRefund: boolean;
  refundRate: number; // 0, 50, 100
  message: string;
} {
  if (daysUntil >= 7) {
    return { canRefund: true, refundRate: 100, message: "100% 전액 환불" };
  }
  if (daysUntil >= 5) {
    return { canRefund: true, refundRate: 50, message: "50% 부분 환불 (수강일 5~6일 전)" };
  }
  return {
    canRefund: false,
    refundRate: 0,
    message: "수강일 4일 이내이므로 환불이 불가합니다.",
  };
}

/* ═══════════════════════════════════════════════
 * POST /api/refund
 *
 * 디지털 에셋: 다운로드 전에만 100% 환불
 * 클래스: 수강일 기준 7일 전 100%, 5~6일 전 50%, 4일 이내 불가
 * ═══════════════════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;

    const body = await request.json();
    const { orderItemId, orderId } = body;

    // 디지털 에셋은 orderItemId, 클래스는 orderId
    if (!orderItemId && !orderId) {
      return NextResponse.json(
        { error: "주문 정보가 필요합니다." },
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

    /* ── Admin 클라이언트 ── */
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

    /* ═══════════════════════════════════════════
     * 클래스 환불
     * ═══════════════════════════════════════════ */
    if (orderId) {
      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .select("id, user_id, status, order_type, payment_method, toss_payment_key, total_amount, schedule, schedule_id")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        return NextResponse.json(
          { error: "주문을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      if (order.user_id !== user.id) {
        return NextResponse.json(
          { error: "본인의 주문만 환불할 수 있습니다." },
          { status: 403 }
        );
      }

      if (order.status === "refunded") {
        return NextResponse.json(
          { error: "이미 환불 처리된 주문입니다." },
          { status: 400 }
        );
      }

      if (order.order_type !== "class") {
        return NextResponse.json(
          { error: "클래스 주문이 아닙니다." },
          { status: 400 }
        );
      }

      // 스케줄 날짜 가져오기
      let scheduleLabel = order.schedule || "";

      // schedule_id가 있으면 DB에서 최신 label 가져오기
      if (order.schedule_id) {
        const { data: schedRow } = await adminClient
          .from("class_schedules")
          .select("schedule_label")
          .eq("id", order.schedule_id)
          .single();
        if (schedRow) {
          scheduleLabel = schedRow.schedule_label;
        }
      }

      const daysUntil = getDaysUntilClass(scheduleLabel);
      const policy = getClassRefundPolicy(daysUntil);

      if (!policy.canRefund) {
        return NextResponse.json(
          { error: policy.message },
          { status: 400 }
        );
      }

      const refundAmount = Math.floor(order.total_amount * (policy.refundRate / 100));

      // 포트원 결제 취소
      if (order.payment_method === "portone" && order.toss_payment_key) {
        const token = await getPortoneToken();
        const cancelRes = await fetch("https://api.iamport.kr/payments/cancel", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imp_uid: order.toss_payment_key,
            reason: `고객 요청 환불 (${policy.message})`,
            amount: refundAmount,
          }),
        });

        const cancelData = await cancelRes.json();

        if (cancelData.code !== 0) {
          console.error("[포트원 클래스 환불 실패]", cancelData.message);
          return NextResponse.json(
            { error: "환불 처리에 실패했습니다. 관리자에게 문의해 주세요." },
            { status: 500 }
          );
        }
      }

      // 주문 상태 업데이트
      await adminClient
        .from("orders")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      // 좌석 복구 (schedule_id가 있는 경우)
      if (order.schedule_id) {
        await adminClient.rpc("increment_schedule_seats", {
          p_schedule_id: order.schedule_id,
          p_quantity: 1,
        }).catch((err: Error) => {
          console.error("[좌석 복구 실패]", err.message);
        });
      }

      const refundMsg =
        policy.refundRate === 100
          ? `전액 환불(₩${refundAmount.toLocaleString("ko-KR")})이 완료되었습니다.`
          : `50% 부분 환불(₩${refundAmount.toLocaleString("ko-KR")})이 완료되었습니다.`;

      return NextResponse.json({
        success: true,
        refundRate: policy.refundRate,
        refundAmount,
        message:
          order.payment_method === "portone"
            ? `${refundMsg} 카드사에 따라 2~5영업일 내 환불됩니다.`
            : `${refundMsg} 관리자 확인 후 환불 처리됩니다.`,
      });
    }

    /* ═══════════════════════════════════════════
     * 디지털 에셋 환불 (기존 로직)
     * ═══════════════════════════════════════════ */
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

    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: "본인의 주문만 환불할 수 있습니다." },
        { status: 403 }
      );
    }

    if (order.status === "refunded") {
      return NextResponse.json(
        { error: "이미 환불 처리된 주문입니다." },
        { status: 400 }
      );
    }

    if (orderItem.downloaded_at) {
      return NextResponse.json(
        { error: "다운로드한 상품은 환불이 불가합니다." },
        { status: 400 }
      );
    }

    // 포트원 결제 자동 환불
    if (order.payment_method === "portone" && order.toss_payment_key) {
      const token = await getPortoneToken();
      const cancelRes = await fetch("https://api.iamport.kr/payments/cancel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imp_uid: order.toss_payment_key,
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

    // 주문 상태 업데이트
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

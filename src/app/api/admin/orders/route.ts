import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";
import { sendGuestPurchaseConfirmation } from "@/utils/email";

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

/* ── PUT: 주문 상태 변경 (입금 확인 / 환불 승인 등) ── */
export async function PUT(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id, status, action } = body as {
    id?: string;
    status?: string;
    action?: string;
  };

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

  /* ──────────────────────────────────────────
   * 환불 수동 승인 (계좌이체 전용)
   * ────────────────────────────────────────── */
  if (action === "approve_refund") {
    // 대상 주문 조회
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, status, order_type, payment_method, schedule_id")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (order.payment_method !== "bank_transfer") {
      return NextResponse.json(
        { error: "계좌이체 주문만 수동 환불 승인이 가능합니다." },
        { status: 400 }
      );
    }

    if (order.status === "refunded") {
      return NextResponse.json(
        { error: "이미 환불 처리된 주문입니다." },
        { status: 400 }
      );
    }

    if (order.status !== "refund_requested") {
      return NextResponse.json(
        { error: "환불 신청된 주문만 승인할 수 있습니다." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // 1) 주문 상태 → refunded
    const { error: updateOrderError } = await adminClient
      .from("orders")
      .update({ status: "refunded", refunded_at: nowIso })
      .eq("id", id);

    if (updateOrderError) {
      return NextResponse.json(
        { error: `주문 상태 변경 실패: ${updateOrderError.message}` },
        { status: 500 }
      );
    }

    // 2) shop 주문이라면 order_items 도 모두 refunded_at 마킹
    if (order.order_type === "shop") {
      const { error: itemsUpdateError } = await adminClient
        .from("order_items")
        .update({ refunded_at: nowIso })
        .eq("order_id", id)
        .is("refunded_at", null);

      if (itemsUpdateError) {
        console.error("[환불 승인 - 아이템 업데이트 실패]", itemsUpdateError);
      }
    }

    // 3) class 주문이라면 좌석 복구
    if (order.order_type === "class" && order.schedule_id) {
      try {
        const { error: seatError } = await adminClient.rpc(
          "increment_schedule_seats",
          {
            p_schedule_id: order.schedule_id,
            p_quantity: 1,
          }
        );
        if (seatError) {
          console.error("[환불 승인 - 좌석 복구 실패]", seatError.message);
        }
      } catch (err) {
        console.error("[환불 승인 - 좌석 복구 실패]", err);
      }
    }

    return NextResponse.json({ success: true, status: "refunded" });
  }

  /* ──────────────────────────────────────────
   * 일반 상태 변경 (입금 확인 등)
   * ────────────────────────────────────────── */
  if (!status) {
    return NextResponse.json(
      { error: "상태값이 필요합니다." },
      { status: 400 }
    );
  }

  const allowedStatuses = [
    "pending",
    "completed",
    "cancelled",
    "refunded",
    "refund_requested",
  ];
  if (!allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: "허용되지 않은 상태값입니다." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.paid_at = nowIso;
  }
  if (status === "refunded") {
    updateData.refunded_at = nowIso;
  }

  // 입금 확인 전에 주문 정보 미리 조회 (이메일 발송용)
  let orderForEmail: Record<string, unknown> | null = null;
  if (status === "completed") {
    const { data: ord } = await adminClient
      .from("orders")
      .select("id, order_type, guest_email, name, total_amount, class_name, schedule, payment_method, toss_order_id, status")
      .eq("id", id)
      .single();
    orderForEmail = ord ?? null;
  }

  const { error } = await adminClient
    .from("orders")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `주문 상태 변경 실패: ${error.message}` },
      { status: 500 }
    );
  }

  // 비회원 입금 확인 시 이메일 발송
  if (
    status === "completed" &&
    orderForEmail &&
    orderForEmail.guest_email &&
    orderForEmail.status === "pending"
  ) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.untitled-studio.kr";
    const orderNumber = (orderForEmail.toss_order_id as string | null) || (orderForEmail.id as string);

    if (orderForEmail.order_type === "shop") {
      // order_items + download_token 조회
      const { data: items } = await adminClient
        .from("order_items")
        .select("download_token, product:products(title)")
        .eq("order_id", id)
        .is("refunded_at", null);

      const emailItems = (items ?? []).map((it) => {
        const prod = it.product as unknown as { title?: string } | { title?: string }[] | null;
        const title = Array.isArray(prod) ? prod[0]?.title : prod?.title;
        return {
          productName: title ?? "상품",
          downloadToken: it.download_token as string,
        };
      });

      sendGuestPurchaseConfirmation({
        kind: "shop",
        to: orderForEmail.guest_email as string,
        customerName: (orderForEmail.name as string) || "고객",
        totalAmount: orderForEmail.total_amount as number,
        paymentMethod: "bank_transfer",
        items: emailItems,
        orderNumber,
        paidAt: nowIso,
        baseUrl,
      }).catch(() => {});
    } else if (orderForEmail.order_type === "class") {
      sendGuestPurchaseConfirmation({
        kind: "class",
        to: orderForEmail.guest_email as string,
        customerName: (orderForEmail.name as string) || "고객",
        className: (orderForEmail.class_name as string) || "",
        schedule: (orderForEmail.schedule as string) || "",
        totalAmount: orderForEmail.total_amount as number,
        paymentMethod: "bank_transfer",
        orderNumber,
        paidAt: nowIso,
        baseUrl,
      }).catch(() => {});
    }
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

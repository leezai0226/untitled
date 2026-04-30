import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";
import { sendPaymentNotification } from "@/utils/email";

/**
 * POST /api/guest-order/bank-transfer
 *
 * 비회원 계좌이체 주문을 서버에서 생성합니다.
 * - RLS 우회를 위해 Service Role Key를 사용합니다.
 * - status는 "pending"으로 기록되며, 관리자가 입금을 확인 후
 *   수동으로 "completed"로 전환해야 실제 다운로드/수강이 활성화됩니다.
 * - 관리자에게 신규 주문 알림 메일을 발송합니다.
 * - 구매자에게는 "입금 대기 안내" 메일을 따로 보내지 않고,
 *   입금 확인 완료 후에 다운로드/수강 안내 메일이 발송됩니다.
 */

// 스팸/중복 결제 방지 — IP당 1분에 5회 제한
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

interface RequestBody {
  orderType: "shop" | "class";
  guestEmail: string;
  guestPhone: string;
  name: string;
  phone: string;
  depositorName: string;
  cashReceiptNumber?: string | null;
  totalAmount: number;

  // 샵 주문
  productIds?: string[];

  // 클래스 주문
  className?: string;
  schedule?: string;
  scheduleId?: string | null;
  classId?: string | null;
  classType?: string;
  experienceLevel?: string;
  message?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;

    const body = (await request.json()) as RequestBody;

    /* ── 공통 필드 검증 ── */
    const orderType = body.orderType;
    if (orderType !== "shop" && orderType !== "class") {
      return NextResponse.json(
        { error: "잘못된 주문 유형입니다." },
        { status: 400 }
      );
    }

    const guestEmail = sanitize(body.guestEmail || "").trim();
    const guestPhone = sanitize(body.guestPhone || "").trim();
    const name = sanitize(body.name || "").trim();
    const phone = sanitize(body.phone || "").trim();
    const depositorName = sanitize(body.depositorName || "").trim();
    const cashReceiptNumber = sanitize(body.cashReceiptNumber || "").trim();

    if (!guestEmail || !EMAIL_REGEX.test(guestEmail)) {
      return NextResponse.json(
        { error: "유효한 이메일 주소를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (!guestPhone) {
      return NextResponse.json(
        { error: "연락처를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: "이름을 입력해 주세요." },
        { status: 400 }
      );
    }
    if (!depositorName) {
      return NextResponse.json(
        { error: "입금자명을 입력해 주세요." },
        { status: 400 }
      );
    }

    /* ── Supabase 서비스 클라이언트 ── */
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "서버 설정 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

    /* ── 주문 유형별 검증 + 금액 재계산 ── */
    let expectedAmount = 0;
    let productRows: { id: string; title: string; price: number }[] = [];
    let className = "";
    let schedule = "";
    const classType = sanitize(body.classType || "").trim();

    if (orderType === "shop") {
      const productIds = Array.isArray(body.productIds) ? body.productIds : [];
      if (productIds.length === 0) {
        return NextResponse.json(
          { error: "주문 상품 정보가 누락되었습니다." },
          { status: 400 }
        );
      }

      const { data: products, error: productsError } = await adminClient
        .from("products")
        .select("id, title, price, remaining_seats")
        .in("id", productIds);

      if (productsError || !products || products.length === 0) {
        return NextResponse.json(
          { error: "상품 정보 조회에 실패했습니다." },
          { status: 400 }
        );
      }

      for (const p of products) {
        if (p.remaining_seats !== null && p.remaining_seats <= 0) {
          return NextResponse.json(
            {
              error: "품절된 상품이 포함되어 있습니다.",
              code: "OUT_OF_STOCK",
            },
            { status: 400 }
          );
        }
      }

      expectedAmount = products.reduce(
        (sum, p) => sum + (p.price ?? 0),
        0
      );
      productRows = products.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price ?? 0,
      }));
    } else {
      // 클래스 주문
      className = sanitize(body.className || "").trim();
      schedule = sanitize(body.schedule || "").trim();
      const scheduleId = body.scheduleId || null;

      if (!className || !schedule) {
        return NextResponse.json(
          { error: "클래스 정보가 누락되었습니다." },
          { status: 400 }
        );
      }

      if (scheduleId) {
        const { data: scheduleRow, error: scheduleError } = await adminClient
          .from("class_schedules")
          .select("remaining_seats")
          .eq("id", scheduleId)
          .single();

        if (scheduleError || !scheduleRow) {
          return NextResponse.json(
            { error: "일정 정보를 찾을 수 없습니다." },
            { status: 400 }
          );
        }
        if (scheduleRow.remaining_seats <= 0) {
          return NextResponse.json(
            { error: "수강 마감된 일정입니다.", code: "CLASS_SOLD_OUT" },
            { status: 400 }
          );
        }
      }

      // 비회원은 할인 없음 (할인은 회원 초급반 이력 기반)
      if (classType === "beginner") {
        expectedAmount = 89000;
      } else if (classType === "intermediate") {
        expectedAmount = 129000;
      } else {
        expectedAmount = 89000;
      }

      if (!body.experienceLevel) {
        return NextResponse.json(
          { error: "편집 경험 수준을 선택해 주세요." },
          { status: 400 }
        );
      }
    }

    // 위변조 방지 — 프론트에서 넘어온 금액 무시하고 서버 계산 금액 사용
    if (typeof body.totalAmount !== "number" || body.totalAmount !== expectedAmount) {
      console.warn(
        `[guest-order] 금액 불일치 — 요청=${body.totalAmount}, 서버=${expectedAmount}`
      );
    }

    /* ── Orders INSERT ── */
    const orderData: Record<string, unknown> = {
      user_id: null,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      order_type: orderType,
      total_amount: expectedAmount,
      name,
      phone,
      payment_method: "bank_transfer",
      depositor_name: depositorName,
      cash_receipt_number: cashReceiptNumber || null,
      status: "pending",
    };

    if (orderType === "class") {
      orderData.class_name = className;
      orderData.schedule = schedule;
      orderData.experience_level = sanitize(body.experienceLevel || "").trim();
      orderData.message = sanitize(body.message || "").trim() || null;
      if (body.scheduleId) orderData.schedule_id = body.scheduleId;
      if (body.classId) orderData.class_id = body.classId;
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert(orderData)
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[guest-order] 주문 생성 실패:", orderError?.message);
      return NextResponse.json(
        { error: `주문 생성 실패: ${orderError?.message || "알 수 없는 오류"}` },
        { status: 500 }
      );
    }

    /* ── 샵 주문: order_items 생성 (download_token은 DB default로 자동 생성) ── */
    if (orderType === "shop" && productRows.length > 0) {
      const orderItemsInsert = productRows.map((p) => ({
        order_id: order.id,
        product_id: p.id,
        price: p.price,
      }));

      const { error: itemsError } = await adminClient
        .from("order_items")
        .insert(orderItemsInsert);

      if (itemsError) {
        console.error(
          "[guest-order] order_items 생성 실패:",
          itemsError.message
        );
        // 롤백: 방금 생성한 order 삭제
        await adminClient.from("orders").delete().eq("id", order.id);
        return NextResponse.json(
          { error: `주문 항목 생성 실패: ${itemsError.message}` },
          { status: 500 }
        );
      }
    }

    /* ── 관리자 알림 (pending 상태) ── */
    try {
      await sendPaymentNotification({
        orderType,
        customerName: name,
        customerEmail: guestEmail,
        customerPhone: phone,
        totalAmount: expectedAmount,
        paymentMethod: "bank_transfer",
        items:
          orderType === "shop"
            ? productRows.map((p) => p.title)
            : undefined,
        className: orderType === "class" ? className : undefined,
        schedule: orderType === "class" ? schedule : undefined,
      });
    } catch (emailErr) {
      console.error("[guest-order] 관리자 알림 메일 발송 실패:", emailErr);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      pending: true,
    });
  } catch (err: unknown) {
    console.error("[guest-order/bank-transfer] 오류:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "서버 내부 오류" },
      { status: 500 }
    );
  }
}

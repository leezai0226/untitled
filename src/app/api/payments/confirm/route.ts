import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";

const CLASS_PRICE = 299000; // 클래스 고정 가격

// 결제 API: 1분에 5회 제한
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const body = await request.json();
  const { paymentKey, orderId, amount, metadata = {} } = body;

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json(
      { error: "필수 파라미터가 누락되었습니다." },
      { status: 400 }
    );
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "서버에 토스 시크릿 키가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

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

  // orderId 형식: "shop__{userId 앞8자}__{timestamp}" 또는 "class__..."
  const isShopOrder = orderId.startsWith("shop__");

  /* ══════════════════════════════════════════════════════
   * 🔒 서버 사이드 금액 위변조 검증
   * 클라이언트가 보낸 amount를 절대 신뢰하지 않고,
   * DB에서 실제 가격을 다시 계산하여 비교합니다.
   * ══════════════════════════════════════════════════════ */

  let verifiedAmount = 0;

  if (isShopOrder) {
    /* ── 샵 주문: 장바구니 → 상품 가격 합산 ── */
    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select("product_id, product:products(price, remaining_seats)")
      .eq("user_id", user.id);

    if (cartError || !cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: "장바구니가 비어 있거나 조회에 실패했습니다." },
        { status: 400 }
      );
    }

    // 🔒 재고 확인: remaining_seats가 0 이하인 상품이 있으면 결제 차단
    for (const item of cartItems) {
      const product = item.product as unknown as {
        price: number;
        remaining_seats: number | null;
      } | null;
      if (product && product.remaining_seats !== null && product.remaining_seats <= 0) {
        return NextResponse.json(
          {
            error: "품절된 상품이 포함되어 있습니다. 장바구니를 확인해 주세요.",
            code: "OUT_OF_STOCK",
          },
          { status: 400 }
        );
      }
    }

    // DB에서 가져온 실제 가격으로 총액 계산
    verifiedAmount = cartItems.reduce((sum, item) => {
      const product = item.product as unknown as { price: number } | null;
      return sum + (product?.price ?? 0);
    }, 0);
  } else {
    /* ── 클래스 주문: schedule_id로 잔여 좌석 사전 확인 ── */
    const scheduleId = metadata.scheduleId;

    if (scheduleId) {
      const { data: scheduleRow, error: scheduleError } = await supabase
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
          {
            error: "수강 마감된 일정입니다. 결제를 진행할 수 없습니다.",
            code: "CLASS_SOLD_OUT",
          },
          { status: 400 }
        );
      }
    }

    // 클래스 고정 가격 사용
    verifiedAmount = CLASS_PRICE;
  }

  // 🚨 금액 비교: 1원이라도 다르면 즉시 거부
  if (verifiedAmount !== Number(amount)) {
    console.error(
      `[결제 위변조 감지] user=${user.id} orderId=${orderId} ` +
        `client_amount=${amount} server_amount=${verifiedAmount}`
    );
    return NextResponse.json(
      {
        error:
          "결제 금액이 일치하지 않습니다. 위변조가 의심됩니다.",
        code: "AMOUNT_MISMATCH",
        redirect: "/checkout/fail?code=AMOUNT_MISMATCH&message=결제 금액이 일치하지 않습니다. 위변조가 의심됩니다.",
      },
      { status: 400 }
    );
  }

  /* ══════════════════════════════════════════════════════
   * ✅ 검증 통과 — 토스페이먼츠 결제 승인 API 호출
   * ══════════════════════════════════════════════════════ */

  const encryptedSecretKey =
    "Basic " + Buffer.from(secretKey + ":").toString("base64");

  const tossRes = await fetch(
    "https://api.tosspayments.com/v1/payments/confirm",
    {
      method: "POST",
      headers: {
        Authorization: encryptedSecretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: verifiedAmount, // 클라이언트 금액이 아닌, 서버 검증된 금액 사용
      }),
    }
  );

  const tossData = await tossRes.json();

  if (!tossRes.ok) {
    return NextResponse.json(
      {
        error: tossData.message || "결제 승인에 실패했습니다.",
        code: tossData.code,
      },
      { status: tossRes.status }
    );
  }

  /* ══════════════════════════════════════════════════════
   * Supabase에 주문 데이터 저장
   * ══════════════════════════════════════════════════════ */

  if (isShopOrder) {
    /* ── 샵 주문 처리 ── */

    // 장바구니에서 상품 목록 다시 조회 (검증 때 가져온 것과 동일)
    const { data: cartItems } = await supabase
      .from("cart_items")
      .select("id, product_id, product:products(price)")
      .eq("user_id", user.id);

    // 2a) Orders 생성
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_type: "shop",
        total_amount: verifiedAmount,
        name: sanitize(metadata.name),
        phone: sanitize(metadata.phone),
        payment_method: "card",
        toss_order_id: orderId,
        toss_payment_key: paymentKey,
        status: "completed",
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: `주문 생성 실패: ${orderError?.message}` },
        { status: 500 }
      );
    }

    // 2b) Order_Items 생성 (DB에서 가져온 실제 가격 사용)
    if (cartItems && cartItems.length > 0) {
      const orderItems = cartItems.map((item) => {
        const product = item.product as unknown as { price: number } | null;
        return {
          order_id: order.id,
          product_id: item.product_id,
          price: product?.price ?? 0,
        };
      });

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("주문 항목 생성 실패:", itemsError.message);
      }
    }

    // 2c) 장바구니 비우기
    await supabase.from("cart_items").delete().eq("user_id", user.id);

    // 2d) 🔒 원자적 재고 차감 (decrement_seats RPC 함수 사용)
    //     동시성 문제 방지: FOR UPDATE 행 잠금으로 안전하게 차감
    if (cartItems && cartItems.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

        for (const item of cartItems) {
          const product = item.product as unknown as {
            remaining_seats: number | null;
          } | null;

          // remaining_seats가 null이 아닌 (수량 제한 있는) 상품만 차감
          if (product && product.remaining_seats !== null) {
            const { data: success, error: rpcError } = await adminClient.rpc(
              "decrement_seats",
              { p_product_id: item.product_id, p_quantity: 1 }
            );

            if (rpcError) {
              console.error(
                `[재고 차감 실패] product_id=${item.product_id}: ${rpcError.message}`
              );
            } else if (success === false) {
              console.error(
                `[재고 부족] product_id=${item.product_id} — 결제는 완료되었으나 재고 부족`
              );
            }
          }
        }
      }
    }
  } else {
    /* ── 클래스 주문 처리 ── */
    const scheduleId = metadata.scheduleId || null;

    // 🔒 좌석 원자적 차감 (schedule_id가 있을 때만)
    if (scheduleId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);
        const { data: seatResult, error: seatError } = await adminClient.rpc(
          "decrement_schedule_seats",
          { p_schedule_id: scheduleId, p_quantity: 1 }
        );

        if (seatError) {
          console.error(`[좌석 차감 실패] schedule_id=${scheduleId}: ${seatError.message}`);
          return NextResponse.json(
            { error: "좌석 차감에 실패했습니다. 관리자에게 문의해 주세요." },
            { status: 500 }
          );
        }

        if (seatResult === false) {
          console.error(`[좌석 경합 발생] schedule_id=${scheduleId} — 결제 승인 후 좌석 부족`);
          return NextResponse.json(
            {
              error: "죄송합니다. 다른 수강생이 먼저 결제하여 자리가 마감되었습니다. 환불 처리됩니다.",
              code: "RACE_CONDITION_SOLD_OUT",
            },
            { status: 409 }
          );
        }
      }
    }

    const orderData: Record<string, unknown> = {
      user_id: user.id,
      order_type: "class",
      total_amount: verifiedAmount,
      class_name: sanitize(metadata.className),
      schedule: sanitize(metadata.schedule),
      name: sanitize(metadata.name),
      phone: sanitize(metadata.phone),
      experience_level: sanitize(metadata.experienceLevel),
      message: sanitize(metadata.message) || null,
      payment_method: "card",
      toss_order_id: orderId,
      toss_payment_key: paymentKey,
      status: "completed",
      paid_at: new Date().toISOString(),
    };

    if (scheduleId) {
      orderData.schedule_id = scheduleId;
    }

    const { error: orderError } = await supabase.from("orders").insert(orderData);

    if (orderError) {
      return NextResponse.json(
        { error: `주문 생성 실패: ${orderError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, payment: tossData });
}

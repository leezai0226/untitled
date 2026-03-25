import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";
import { cookies } from "next/headers";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

const KAKAO_SECRET_KEY = process.env.KAKAO_SECRET_KEY ?? "";
const KAKAO_CID = process.env.KAKAO_CID ?? "TC0ONETIME";

export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  if (!KAKAO_SECRET_KEY) {
    return NextResponse.json(
      { error: "서버에 카카오페이 시크릿 키가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { pg_token } = body;

  if (!pg_token) {
    return NextResponse.json(
      { error: "pg_token이 필요합니다." },
      { status: 400 }
    );
  }

  /* ═══ 쿠키에서 결제 세션 복원 ═══ */
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("kakaopay_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { error: "결제 세션이 만료되었습니다. 다시 시도해 주세요." },
      { status: 400 }
    );
  }

  let session: {
    tid: string;
    partnerOrderId: string;
    partnerUserId: string;
    amount: number;
    orderType: string;
    metadata: Record<string, unknown>;
  };

  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.json(
      { error: "결제 세션 데이터가 유효하지 않습니다." },
      { status: 400 }
    );
  }

  // 세션 쿠키 즉시 삭제 (재사용 방지)
  cookieStore.delete("kakaopay_session");

  /* ═══ Supabase 유저 확인 ═══ */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== session.partnerUserId) {
    return NextResponse.json(
      { error: "로그인 정보가 일치하지 않습니다." },
      { status: 401 }
    );
  }

  /* ═══ 카카오페이 결제 승인 요청 ═══ */
  const approveRes = await fetch(
    "https://open-api.kakaopay.com/online/v1/payment/approve",
    {
      method: "POST",
      headers: {
        Authorization: `SECRET_KEY ${KAKAO_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cid: KAKAO_CID,
        tid: session.tid,
        partner_order_id: session.partnerOrderId,
        partner_user_id: session.partnerUserId,
        pg_token,
      }),
    }
  );

  const approveData = await approveRes.json();

  if (!approveRes.ok) {
    console.error("[카카오페이 Approve 실패]", approveData);
    return NextResponse.json(
      { error: approveData.msg || "카카오페이 결제 승인에 실패했습니다." },
      { status: approveRes.status }
    );
  }

  /* ═══ DB 주문 처리 ═══ */
  const { orderType, metadata, partnerOrderId, amount } = session;
  const isShopOrder = orderType === "shop";

  if (isShopOrder) {
    /* ── 샵 주문 처리 ── */
    const { data: cartItems } = await supabase
      .from("cart_items")
      .select("id, product_id, product:products(price, remaining_seats)")
      .eq("user_id", user.id);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_type: "shop",
        total_amount: amount,
        name: sanitize(metadata.name as string),
        phone: sanitize(metadata.phone as string),
        payment_method: "kakaopay",
        toss_order_id: partnerOrderId,
        toss_payment_key: session.tid,
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

    if (cartItems && cartItems.length > 0) {
      const orderItems = cartItems.map((item) => {
        const product = item.product as unknown as { price: number } | null;
        return {
          order_id: order.id,
          product_id: item.product_id,
          price: product?.price ?? 0,
        };
      });

      await supabase.from("order_items").insert(orderItems);
    }

    await supabase.from("cart_items").delete().eq("user_id", user.id);

    // 재고 차감 (Service Role)
    if (cartItems && cartItems.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);
        for (const item of cartItems) {
          const product = item.product as unknown as {
            remaining_seats: number | null;
          } | null;
          if (product && product.remaining_seats !== null) {
            await adminClient.rpc("decrement_seats", {
              p_product_id: item.product_id,
              p_quantity: 1,
            });
          }
        }
      }
    }
  } else {
    /* ── 클래스 주문 처리 ── */
    const scheduleId = (metadata.scheduleId as string) || null;

    // 좌석 원자적 차감
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
          return NextResponse.json(
            {
              error: "죄송합니다. 다른 수강생이 먼저 결제하여 자리가 마감되었습니다.",
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
      total_amount: amount,
      class_name: sanitize(metadata.className as string),
      schedule: sanitize(metadata.schedule as string),
      name: sanitize(metadata.name as string),
      phone: sanitize(metadata.phone as string),
      experience_level: sanitize(metadata.experienceLevel as string),
      message: sanitize(metadata.message as string) || null,
      payment_method: "kakaopay",
      toss_order_id: partnerOrderId,
      toss_payment_key: session.tid,
      status: "completed",
      paid_at: new Date().toISOString(),
    };

    if (scheduleId) orderData.schedule_id = scheduleId;

    const { error: orderError } = await supabase
      .from("orders")
      .insert(orderData);

    if (orderError) {
      return NextResponse.json(
        { error: `주문 생성 실패: ${orderError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, payment: approveData });
}

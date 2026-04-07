import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";
import { sendPaymentNotification } from "@/utils/email";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });

const PORTONE_API_KEY = process.env.PORTONE_API_KEY ?? "";
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET ?? "";

/* ── 포트원 V1 액세스 토큰 발급 ── */
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
    console.error("[포트원 토큰 발급 실패]", data.message);
    throw new Error("결제 검증 서버 인증에 실패했습니다. 관리자에게 문의해 주세요.");
  }

  return data.response.access_token;
}

/* ── 포트원 V1 결제 정보 조회 ── */
async function getPaymentInfo(impUid: string, token: string) {
  const res = await fetch(`https://api.iamport.kr/payments/${impUid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  if (data.code !== 0 || !data.response) {
    throw new Error(data.message || "결제 정보 조회 실패");
  }

  return data.response;
}

/* ═══════════════════════════════════════════════
 * POST /api/portone/verify
 *
 * 프론트엔드에서 IMP.request_pay() 완료 후
 * imp_uid, merchant_uid, metadata를 보내 사후 검증을 수행합니다.
 * ═══════════════════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;

    if (!PORTONE_API_KEY || !PORTONE_API_SECRET) {
      return NextResponse.json(
        { error: "서버에 포트원 API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    /* ── 요청 파싱 ── */
    const body = await request.json();
    const { imp_uid, merchant_uid, metadata } = body;

    if (!imp_uid || !merchant_uid) {
      return NextResponse.json(
        { error: "imp_uid와 merchant_uid가 필요합니다." },
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

    /* ── 포트원 결제 검증 ── */
    const token = await getPortoneToken();
    const payment = await getPaymentInfo(imp_uid, token);

    // 결제 상태 확인
    if (payment.status !== "paid") {
      return NextResponse.json(
        { error: `결제가 완료되지 않았습니다. (상태: ${payment.status})` },
        { status: 400 }
      );
    }

    /* ── 서버 사이드 금액 검증 ── */
    const orderType = metadata?.orderType || "shop";
    const isShopOrder = orderType === "shop";
    let expectedAmount = 0;

    if (isShopOrder) {
      // 장바구니 기반 금액 검증
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

      // 품절 체크
      for (const item of cartItems) {
        const product = item.product as unknown as {
          price: number;
          remaining_seats: number | null;
        } | null;
        if (product && product.remaining_seats !== null && product.remaining_seats <= 0) {
          return NextResponse.json(
            { error: "품절된 상품이 포함되어 있습니다.", code: "OUT_OF_STOCK" },
            { status: 400 }
          );
        }
      }

      expectedAmount = cartItems.reduce((sum, item) => {
        const product = item.product as unknown as { price: number } | null;
        return sum + (product?.price ?? 0);
      }, 0);
    } else {
      // 클래스 주문 — 좌석 사전 확인
      const scheduleId = metadata?.scheduleId;
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
            { error: "수강 마감된 일정입니다.", code: "CLASS_SOLD_OUT" },
            { status: 400 }
          );
        }
      }

      // 클래스 가격 조회
      const classId = metadata?.classId;
      if (classId) {
        const { data: classRow } = await supabase
          .from("classes")
          .select("price")
          .eq("id", classId)
          .single();
        expectedAmount = classRow?.price ?? 299000;
      } else {
        expectedAmount = 299000;
      }
    }

    // 위변조 검증: 실제 결제 금액 vs 서버 기대 금액
    if (payment.amount !== expectedAmount) {
      console.error(
        `[포트원 위변조 감지] imp_uid=${imp_uid}, paid=${payment.amount}, expected=${expectedAmount}`
      );
      return NextResponse.json(
        { error: "결제 금액이 일치하지 않습니다. 위변조가 감지되었습니다." },
        { status: 400 }
      );
    }

    /* ═══ DB 주문 처리 ═══ */
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
          total_amount: payment.amount,
          name: sanitize(metadata?.name as string),
          phone: sanitize(metadata?.phone as string),
          payment_method: "portone",
          toss_order_id: merchant_uid,
          toss_payment_key: imp_uid,
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
      const scheduleId = (metadata?.scheduleId as string) || null;

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
            console.error(
              `[좌석 차감 실패] schedule_id=${scheduleId}: ${seatError.message}`
            );
            return NextResponse.json(
              {
                error:
                  "좌석 차감에 실패했습니다. 관리자에게 문의해 주세요.",
              },
              { status: 500 }
            );
          }

          if (seatResult === false) {
            return NextResponse.json(
              {
                error:
                  "죄송합니다. 다른 수강생이 먼저 결제하여 자리가 마감되었습니다.",
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
        total_amount: payment.amount,
        class_name: sanitize(metadata?.className as string),
        schedule: sanitize(metadata?.schedule as string),
        name: sanitize(metadata?.name as string),
        phone: sanitize(metadata?.phone as string),
        experience_level: sanitize(metadata?.experienceLevel as string),
        message: sanitize(metadata?.message as string) || null,
        payment_method: "portone",
        toss_order_id: merchant_uid,
        toss_payment_key: imp_uid,
        status: "completed",
        paid_at: new Date().toISOString(),
      };

      if (scheduleId) orderData.schedule_id = scheduleId;
      if (metadata?.classId) orderData.class_id = metadata.classId;

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

    /* ═══ 관리자 이메일 알림 (비동기 — 실패해도 결제 성공) ═══ */
    const emailData = {
      orderType: isShopOrder ? ("shop" as const) : ("class" as const),
      customerName: sanitize(metadata?.name as string) || "이름 없음",
      customerEmail: user.email || "",
      customerPhone: sanitize(metadata?.phone as string) || "",
      totalAmount: payment.amount as number,
      paymentMethod: "portone",
      ...(isShopOrder
        ? {
            items: ((await supabase
              .from("cart_items")
              .select("product:products(title)")
              .eq("user_id", user.id)
              .then(r => r.data)) || []).map(
              (i: Record<string, unknown>) =>
                (i.product as { title: string } | null)?.title || "상품"
            ),
          }
        : {
            className: sanitize(metadata?.className as string) || "",
            schedule: sanitize(metadata?.schedule as string) || "",
          }),
    };

    // 장바구니는 이미 삭제됐으므로 metadata에서 상품명 추출 시도
    if (isShopOrder && (!emailData.items || emailData.items.length === 0)) {
      emailData.items = [sanitize(metadata?.productName as string) || "디지털 에셋"];
    }

    sendPaymentNotification(emailData).catch(() => {});

    return NextResponse.json({ success: true, payment });
  } catch (err: unknown) {
    console.error("POST /api/portone/verify 에러:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "서버 내부 오류" },
      { status: 500 }
    );
  }
}

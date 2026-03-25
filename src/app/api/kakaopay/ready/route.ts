import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createRateLimiter } from "@/utils/rateLimit";
import { cookies } from "next/headers";

const CLASS_PRICE = 299000;
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

  const body = await request.json();
  const { orderType, orderName, metadata = {} } = body;

  // orderType: "shop" | "class"
  const isShopOrder = orderType === "shop";

  /* ═══ 서버 사이드 금액 검증 ═══ */
  let verifiedAmount = 0;
  let quantity = 1;

  if (isShopOrder) {
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

    verifiedAmount = cartItems.reduce((sum, item) => {
      const product = item.product as unknown as { price: number } | null;
      return sum + (product?.price ?? 0);
    }, 0);
    quantity = cartItems.length;
  } else {
    // 클래스 주문 — 좌석 사전 확인
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
          { error: "수강 마감된 일정입니다.", code: "CLASS_SOLD_OUT" },
          { status: 400 }
        );
      }
    }
    verifiedAmount = CLASS_PRICE;
  }

  /* ═══ 카카오페이 결제 준비 요청 ═══ */
  const partnerOrderId = `${orderType}__${user.id.substring(0, 8)}__${Date.now()}`;
  const origin = request.headers.get("origin") || request.nextUrl.origin;

  const kakaoRes = await fetch(
    "https://open-api.kakaopay.com/online/v1/payment/ready",
    {
      method: "POST",
      headers: {
        Authorization: `SECRET_KEY ${KAKAO_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cid: KAKAO_CID,
        partner_order_id: partnerOrderId,
        partner_user_id: user.id,
        item_name: orderName || (isShopOrder ? "디지털 에셋" : "원데이 클래스"),
        quantity,
        total_amount: verifiedAmount,
        tax_free_amount: 0,
        approval_url: `${origin}/checkout/success?orderId=${partnerOrderId}`,
        cancel_url: `${origin}/checkout/fail?code=USER_CANCEL&message=결제가 취소되었습니다.`,
        fail_url: `${origin}/checkout/fail?code=PAYMENT_FAILED&message=결제에 실패했습니다.`,
      }),
    }
  );

  const kakaoData = await kakaoRes.json();

  if (!kakaoRes.ok) {
    console.error("[카카오페이 Ready 실패]", kakaoData);
    return NextResponse.json(
      { error: kakaoData.msg || "카카오페이 결제 준비에 실패했습니다." },
      { status: kakaoRes.status }
    );
  }

  /* ═══ tid + 메타데이터를 httpOnly 쿠키에 저장 ═══ */
  const paymentSession = JSON.stringify({
    tid: kakaoData.tid,
    partnerOrderId,
    partnerUserId: user.id,
    amount: verifiedAmount,
    orderType,
    metadata,
  });

  const cookieStore = await cookies();
  cookieStore.set("kakaopay_session", paymentSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10분
  });

  return NextResponse.json({
    success: true,
    redirect_pc_url: kakaoData.next_redirect_pc_url,
    redirect_mobile_url: kakaoData.next_redirect_mobile_url,
  });
}

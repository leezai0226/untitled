import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";
import {
  sendPaymentNotification,
  sendGuestPurchaseConfirmation,
} from "@/utils/email";

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
    throw new Error(
      "결제 검증 서버 인증에 실패했습니다. 관리자에게 문의해 주세요."
    );
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

/* ── 요청에서 베이스 URL 추출 (이메일 링크 생성용) ── */
function resolveBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/* ═══════════════════════════════════════════════
 * POST /api/portone/verify
 *
 * 프론트엔드에서 IMP.request_pay() 완료 후
 * imp_uid, merchant_uid, metadata를 보내 사후 검증을 수행합니다.
 *
 * 회원/비회원 모두 지원:
 *  - 회원: supabase.auth.getUser()로 user_id 확인
 *  - 비회원: metadata.guest = { email, phone } 로 식별, user_id는 null
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

    /* ── 유저 인증 (비회원 허용) ── */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isGuest = !user;
    const guestEmail = sanitize((metadata?.guestEmail as string) || "").trim();
    const guestPhone = sanitize((metadata?.guestPhone as string) || "").trim();

    if (isGuest) {
      // 비회원이면 guestEmail/guestPhone 필수
      if (!guestEmail || !guestPhone) {
        return NextResponse.json(
          {
            error:
              "비회원 결제의 경우 이메일과 연락처가 필요합니다. 결제 정보를 확인해 주세요.",
          },
          { status: 400 }
        );
      }
      // 간단한 이메일 형식 검증
      if (!/^\S+@\S+\.\S+$/.test(guestEmail)) {
        return NextResponse.json(
          { error: "유효한 이메일 주소가 아닙니다." },
          { status: 400 }
        );
      }
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

    let expectedAmount = 0;

    if (isShopOrder) {
      /* ── 샵 주문 금액 검증 ──
       * 회원: cart_items 기반 합계
       * 비회원: metadata.productIds 기반 합계 (장바구니 없음)
       */
      if (isGuest) {
        const productIds = Array.isArray(metadata?.productIds)
          ? (metadata.productIds as string[])
          : [];

        if (productIds.length === 0) {
          return NextResponse.json(
            { error: "주문 상품 정보가 누락되었습니다." },
            { status: 400 }
          );
        }

        const { data: guestProducts, error: gpError } = await adminClient
          .from("products")
          .select("id, price, remaining_seats, title")
          .in("id", productIds);

        if (gpError || !guestProducts || guestProducts.length === 0) {
          return NextResponse.json(
            { error: "상품 정보 조회에 실패했습니다." },
            { status: 400 }
          );
        }

        for (const p of guestProducts) {
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

        expectedAmount = guestProducts.reduce(
          (sum, p) => sum + (p.price ?? 0),
          0
        );
      } else {
        // 회원: 장바구니 기반
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
          if (
            product &&
            product.remaining_seats !== null &&
            product.remaining_seats <= 0
          ) {
            return NextResponse.json(
              {
                error: "품절된 상품이 포함되어 있습니다.",
                code: "OUT_OF_STOCK",
              },
              { status: 400 }
            );
          }
        }

        expectedAmount = cartItems.reduce((sum, item) => {
          const product = item.product as unknown as { price: number } | null;
          return sum + (product?.price ?? 0);
        }, 0);
      }
    } else {
      /* ── 클래스 주문 금액 검증 ── */
      const scheduleId = metadata?.scheduleId;
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

      // 클래스 타입별 가격 결정
      const classTypeFromMeta = metadata?.classType as string | undefined;

      if (classTypeFromMeta === "beginner") {
        expectedAmount = 89000;
      } else if (classTypeFromMeta === "intermediate") {
        // 할인은 회원일 때만 적용 (초급반 수강 이력 기반)
        if (!isGuest && user) {
          const { data: beginnerOrders } = await adminClient
            .from("orders")
            .select("id")
            .eq("user_id", user.id)
            .eq("order_type", "class")
            .eq("status", "completed")
            .ilike("class_name", "%초급반%")
            .limit(1);

          if (beginnerOrders && beginnerOrders.length > 0) {
            expectedAmount = 109000;
          } else {
            expectedAmount = 129000;
          }
        } else {
          // 비회원은 할인 미적용
          expectedAmount = 129000;
        }
      } else {
        expectedAmount = 89000;
      }
    }

    // 위변조 검증
    if (payment.amount !== expectedAmount) {
      console.error(
        `[포트원 위변조 감지] imp_uid=${imp_uid}, paid=${payment.amount}, expected=${expectedAmount}`
      );
      return NextResponse.json(
        {
          error: "결제 금액이 일치하지 않습니다. 위변조가 감지되었습니다.",
        },
        { status: 400 }
      );
    }

    /* ═══ DB 주문 생성 (Service Role) ═══ */
    const paidAtIso = new Date().toISOString();

    // 이메일 메타 (구매 확인 메일 + 관리자 알림용)
    const buyerEmail = isGuest ? guestEmail : user.email || "";
    const buyerPhone = isGuest ? guestPhone : sanitize(metadata?.phone as string) || "";

    const productsForEmail: { productName: string; downloadToken: string }[] =
      [];
    let createdOrderId: string | null = null;
    let createdClassInfo: { className: string; schedule: string } | null = null;

    if (isShopOrder) {
      /* ── 샵 주문 생성 ── */
      const orderInsert: Record<string, unknown> = {
        user_id: isGuest ? null : user!.id,
        order_type: "shop",
        total_amount: payment.amount,
        name: sanitize(metadata?.name as string),
        phone: sanitize(metadata?.phone as string),
        payment_method: "portone",
        toss_order_id: merchant_uid,
        toss_payment_key: imp_uid,
        status: "completed",
        paid_at: paidAtIso,
      };

      if (isGuest) {
        orderInsert.guest_email = guestEmail;
        orderInsert.guest_phone = guestPhone;
      }

      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert(orderInsert)
        .select("id")
        .single();

      if (orderError || !order) {
        return NextResponse.json(
          { error: `주문 생성 실패: ${orderError?.message}` },
          { status: 500 }
        );
      }

      createdOrderId = order.id;

      /* ── order_items 생성 ── */
      type ProductLite = {
        id: string;
        price: number;
        title: string;
        remaining_seats: number | null;
      };
      let products: ProductLite[] = [];

      if (isGuest) {
        const productIds = (metadata.productIds as string[]) ?? [];
        const { data: gp } = await adminClient
          .from("products")
          .select("id, price, title, remaining_seats")
          .in("id", productIds);
        products = (gp ?? []) as ProductLite[];
      } else {
        const { data: cartItems } = await adminClient
          .from("cart_items")
          .select(
            "id, product_id, product:products(id, price, title, remaining_seats)"
          )
          .eq("user_id", user!.id);
        products = (cartItems ?? [])
          .map(
            (c) =>
              c.product as unknown as ProductLite | null
          )
          .filter((p): p is ProductLite => !!p);
      }

      if (products.length > 0) {
        const orderItemsInsert = products.map((p) => ({
          order_id: order.id,
          product_id: p.id,
          price: p.price ?? 0,
        }));

        const { data: insertedItems, error: itemsError } = await adminClient
          .from("order_items")
          .insert(orderItemsInsert)
          .select("id, product_id, download_token");

        if (itemsError) {
          console.error("[order_items insert 실패]", itemsError.message);
        } else if (insertedItems) {
          for (const ins of insertedItems) {
            const pRow = products.find((p) => p.id === ins.product_id);
            if (pRow && ins.download_token) {
              productsForEmail.push({
                productName: pRow.title,
                downloadToken: ins.download_token as string,
              });
            }
          }
        }

        // 회원: 장바구니 비우기
        if (!isGuest) {
          await adminClient
            .from("cart_items")
            .delete()
            .eq("user_id", user!.id);
        }

        // 재고 차감
        for (const p of products) {
          if (p.remaining_seats !== null) {
            await adminClient.rpc("decrement_seats", {
              p_product_id: p.id,
              p_quantity: 1,
            });
          }
        }
      }
    } else {
      /* ── 클래스 주문 생성 ── */
      const scheduleId = (metadata?.scheduleId as string) || null;

      // 좌석 원자적 차감
      if (scheduleId) {
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

      const orderData: Record<string, unknown> = {
        user_id: isGuest ? null : user!.id,
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
        paid_at: paidAtIso,
      };

      if (scheduleId) orderData.schedule_id = scheduleId;
      if (metadata?.classId) orderData.class_id = metadata.classId;
      if (isGuest) {
        orderData.guest_email = guestEmail;
        orderData.guest_phone = guestPhone;
      }

      const { data: classOrder, error: orderError } = await adminClient
        .from("orders")
        .insert(orderData)
        .select("id")
        .single();

      if (orderError || !classOrder) {
        return NextResponse.json(
          { error: `주문 생성 실패: ${orderError?.message}` },
          { status: 500 }
        );
      }

      createdOrderId = classOrder.id;
      createdClassInfo = {
        className: sanitize(metadata?.className as string) || "",
        schedule: sanitize(metadata?.schedule as string) || "",
      };
    }

    /* ═══ 관리자 알림 메일 ═══ */
    const customerName = sanitize(metadata?.name as string) || "이름 없음";

    if (isShopOrder) {
      const productNames = productsForEmail.map((p) => p.productName);
      sendPaymentNotification({
        orderType: "shop",
        customerName,
        customerEmail: buyerEmail,
        customerPhone: buyerPhone,
        totalAmount: payment.amount,
        paymentMethod: "portone",
        items:
          productNames.length > 0
            ? productNames
            : [sanitize(metadata?.productName as string) || "디지털 에셋"],
      }).catch(() => {});
    } else {
      sendPaymentNotification({
        orderType: "class",
        customerName,
        customerEmail: buyerEmail,
        customerPhone: buyerPhone,
        totalAmount: payment.amount,
        paymentMethod: "portone",
        className: createdClassInfo?.className || "",
        schedule: createdClassInfo?.schedule || "",
      }).catch(() => {});
    }

    /* ═══ 구매자 본인에게 구매 확인 + 상품 전달 메일 ═══
     * 비회원은 다운로드 링크/클래스 안내를 메일로 받아야 접근 가능하므로 필수.
     * 회원도 동일한 메일을 받되, 마이페이지에서도 접근 가능.
     *
     * ⚠️ 결제는 이미 포트원에서 완료된 상태이므로, 메일 발송 실패가
     *    주문 완료 자체를 막지는 않습니다. 대신 응답에 emailSent 플래그를 포함해
     *    클라이언트에서 "메일이 도달하지 않으면 관리자에게 문의" 안내를 표시합니다.
     */
    let emailSent = false;
    let emailError: string | undefined;

    if (buyerEmail) {
      const baseUrl = resolveBaseUrl(request);
      const orderNumber = merchant_uid || createdOrderId || "";

      try {
        if (isShopOrder) {
          const result = await sendGuestPurchaseConfirmation({
            kind: "shop",
            to: buyerEmail,
            customerName,
            totalAmount: payment.amount,
            paymentMethod: "portone",
            items: productsForEmail,
            orderNumber,
            paidAt: paidAtIso,
            baseUrl,
          });
          emailSent = result.ok;
          emailError = result.error;
        } else if (createdClassInfo) {
          const result = await sendGuestPurchaseConfirmation({
            kind: "class",
            to: buyerEmail,
            customerName,
            className: createdClassInfo.className,
            schedule: createdClassInfo.schedule,
            totalAmount: payment.amount,
            paymentMethod: "portone",
            orderNumber,
            paidAt: paidAtIso,
            baseUrl,
          });
          emailSent = result.ok;
          emailError = result.error;
        }
      } catch (err) {
        emailSent = false;
        emailError = err instanceof Error ? err.message : "email error";
        console.error("[verify] 구매 확인 메일 발송 예외:", err);
      }
    }

    // 관리자 알림은 이미 위에서 비동기 실행 중 — 대기하지 않음

    return NextResponse.json({
      success: true,
      guest: isGuest,
      payment,
      emailSent,
      emailError,
    });
  } catch (err: unknown) {
    console.error("POST /api/portone/verify 에러:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "서버 내부 오류" },
      { status: 500 }
    );
  }
}

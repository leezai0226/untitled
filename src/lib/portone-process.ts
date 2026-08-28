/**
 * PortOne 결제 검증 후 DB 처리 + 메일 발송 공용 로직.
 *
 * verify 라우트(클라이언트 콜백 경로)와 webhook 라우트가 모두 호출하며,
 * 동일 imp_uid에 대해 두 경로가 동시에 들어와도 멱등 처리됩니다.
 *
 * 멱등성:
 *  - DB의 orders.toss_payment_key 에 unique 인덱스가 걸려 있어
 *    중복 INSERT 시도 시 23505로 실패하고, alreadyProcessed 응답으로 떨어집니다.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sanitize } from "@/utils/sanitize";
import { isUpcoming } from "@/utils/release";
import { findApplicableCoupon, redeemCoupon } from "@/lib/coupon";
import {
  sendPaymentNotification,
  sendGuestPurchaseConfirmation,
  type EmailResult,
} from "@/utils/email";

export interface ProcessPaymentInput {
  payment: { imp_uid: string; merchant_uid: string; amount: number };
  metadata: Record<string, unknown>;
  userId: string | null;     // null 이면 비회원
  userEmail: string | null;  // 회원 메일(비회원이면 metadata.guestEmail 사용)
  baseUrl: string;
}

export interface ProcessPaymentResult {
  ok: boolean;
  alreadyProcessed?: boolean;
  orderId?: string;
  emailSent?: boolean;
  emailError?: string;
  error?: string;
  status?: number;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 서버 설정 누락");
  return createServiceClient(url, key);
}

export async function processPortonePayment(
  input: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
  const { payment, metadata, userId, userEmail, baseUrl } = input;
  const adminClient = getAdminClient();
  const isGuest = !userId;

  const guestEmail = sanitize((metadata?.guestEmail as string) || "").trim();
  const guestPhone = sanitize((metadata?.guestPhone as string) || "").trim();

  /* ─── 0. 멱등성 체크 ─── */
  const { data: existing } = await adminClient
    .from("orders")
    .select("id, status")
    .eq("toss_payment_key", payment.imp_uid)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyProcessed: true, orderId: existing.id };
  }

  const orderType = (metadata?.orderType as string) || "shop";
  const isShopOrder = orderType === "shop";
  const isCourseOrder = orderType === "course";

  /* ─── 1. 금액 검증 ─── */
  let expectedAmount = 0;
  let courseRow: { id: string; title: string; price: number } | null = null;
  let shopProductsForCoupon: { id: string; price: number }[] = [];
  let appliedCouponId: string | null = null;
  let appliedCouponCode: string | null = null;
  let appliedDiscount = 0;

  if (isCourseOrder) {
    /* 온라인 강좌 — 회원 전용 */
    if (isGuest) {
      return {
        ok: false,
        error: "온라인 강의는 회원만 구매할 수 있습니다.",
        status: 400,
      };
    }
    const courseId = (metadata?.courseId as string) || "";
    if (!courseId) {
      return { ok: false, error: "강좌 정보가 누락되었습니다.", status: 400 };
    }
    const { data: course, error: courseError } = await adminClient
      .from("courses")
      .select("id, title, price, is_active")
      .eq("id", courseId)
      .single();
    if (courseError || !course) {
      return { ok: false, error: "강좌를 찾을 수 없습니다.", status: 400 };
    }
    if (!course.is_active) {
      return { ok: false, error: "판매 중이 아닌 강좌입니다.", status: 400 };
    }
    // 이미 수강권이 있으면 중복 구매 차단
    const { data: existingEnrollment } = await adminClient
      .from("course_enrollments")
      .select("id, expires_at")
      .eq("user_id", userId!)
      .eq("course_id", courseId)
      .maybeSingle();
    if (
      existingEnrollment &&
      new Date(existingEnrollment.expires_at as string) > new Date()
    ) {
      return {
        ok: false,
        error: "이미 수강 중인 강좌입니다.",
        status: 400,
      };
    }
    courseRow = { id: course.id, title: course.title, price: course.price };
    expectedAmount = course.price ?? 0;
  } else if (isShopOrder) {
    if (isGuest) {
      const productIds = Array.isArray(metadata?.productIds)
        ? (metadata.productIds as string[])
        : [];
      if (productIds.length === 0) {
        return { ok: false, error: "주문 상품 정보가 누락되었습니다.", status: 400 };
      }
      const { data: guestProducts, error: gpError } = await adminClient
        .from("products")
        .select("id, price, remaining_seats, title, release_at, release_mode")
        .in("id", productIds);
      if (gpError || !guestProducts || guestProducts.length === 0) {
        return { ok: false, error: "상품 정보 조회에 실패했습니다.", status: 400 };
      }
      for (const p of guestProducts) {
        if (isUpcoming(p)) {
          return {
            ok: false,
            error: "아직 판매가 시작되지 않은 상품입니다.",
            status: 400,
          };
        }
        if (p.remaining_seats !== null && p.remaining_seats <= 0) {
          return {
            ok: false,
            error: "품절된 상품이 포함되어 있습니다.",
            status: 400,
          };
        }
      }
      expectedAmount = guestProducts.reduce(
        (sum, p) => sum + (p.price ?? 0),
        0
      );
      shopProductsForCoupon = guestProducts.map((p) => ({
        id: p.id,
        price: p.price ?? 0,
      }));
    } else {
      const { data: cartItems, error: cartError } = await adminClient
        .from("cart_items")
        .select("product_id, product:products(id, price, remaining_seats, release_at, release_mode)")
        .eq("user_id", userId!);
      if (cartError || !cartItems || cartItems.length === 0) {
        return {
          ok: false,
          error: "장바구니가 비어 있거나 조회에 실패했습니다.",
          status: 400,
        };
      }
      for (const item of cartItems) {
        const product = item.product as unknown as {
          price: number;
          remaining_seats: number | null;
          release_at: string | null;
          release_mode: string | null;
        } | null;
        if (product && isUpcoming(product)) {
          return {
            ok: false,
            error: "아직 판매가 시작되지 않은 상품입니다.",
            status: 400,
          };
        }
        if (
          product &&
          product.remaining_seats !== null &&
          product.remaining_seats <= 0
        ) {
          return {
            ok: false,
            error: "품절된 상품이 포함되어 있습니다.",
            status: 400,
          };
        }
      }
      expectedAmount = cartItems.reduce((sum, item) => {
        const product = item.product as unknown as { price: number } | null;
        return sum + (product?.price ?? 0);
      }, 0);
      shopProductsForCoupon = cartItems
        .map((item) => item.product as unknown as { id: string; price: number } | null)
        .filter((p): p is { id: string; price: number } => !!p);
    }
  } else {
    /* 클래스 */
    const scheduleId = metadata?.scheduleId as string | undefined;
    if (scheduleId) {
      const { data: scheduleRow, error: scheduleError } = await adminClient
        .from("class_schedules")
        .select("remaining_seats")
        .eq("id", scheduleId)
        .single();
      if (scheduleError || !scheduleRow) {
        return { ok: false, error: "일정 정보를 찾을 수 없습니다.", status: 400 };
      }
      if (scheduleRow.remaining_seats <= 0) {
        return { ok: false, error: "수강 마감된 일정입니다.", status: 400 };
      }
    }

    const classTypeFromMeta = metadata?.classType as string | undefined;
    if (classTypeFromMeta === "beginner") {
      expectedAmount = 89000;
    } else if (classTypeFromMeta === "intermediate") {
      if (!isGuest && userId) {
        const { data: beginnerOrders } = await adminClient
          .from("orders")
          .select("id")
          .eq("user_id", userId)
          .eq("order_type", "class")
          .eq("status", "completed")
          .ilike("class_name", "%초급반%")
          .limit(1);
        expectedAmount =
          beginnerOrders && beginnerOrders.length > 0 ? 109000 : 129000;
      } else {
        expectedAmount = 129000;
      }
    } else {
      expectedAmount = 89000;
    }
  }

  /* ─── 1.5 쿠폰 적용 (샵 주문만) ─── */
  const couponCode = sanitize((metadata?.couponCode as string) || "").trim();
  if (isShopOrder && couponCode && shopProductsForCoupon.length > 0) {
    const result = await findApplicableCoupon(
      adminClient,
      couponCode,
      shopProductsForCoupon
    );
    if ("error" in result) {
      return { ok: false, error: `쿠폰 오류: ${result.error}`, status: 400 };
    }
    appliedCouponId = result.coupon.id;
    appliedCouponCode = result.coupon.code;
    appliedDiscount = result.discountAmount;
    expectedAmount = Math.max(0, expectedAmount - appliedDiscount);
  }

  if (payment.amount !== expectedAmount) {
    console.error(
      `[포트원 위변조 감지] imp_uid=${payment.imp_uid}, paid=${payment.amount}, expected=${expectedAmount}`
    );
    return {
      ok: false,
      error: "결제 금액이 일치하지 않습니다.",
      status: 400,
    };
  }

  /* ─── 2. DB INSERT ─── */
  const paidAtIso = new Date().toISOString();
  const buyerEmail = isGuest ? guestEmail : userEmail || "";
  const buyerPhone = isGuest
    ? guestPhone
    : sanitize(metadata?.phone as string) || "";

  const productsForEmail: { productName: string; downloadToken: string }[] = [];
  let createdOrderId: string | null = null;
  let createdClassInfo: { className: string; schedule: string } | null = null;

  if (isCourseOrder && courseRow) {
    /* 온라인 강좌 주문 (회원 전용) */
    const orderInsert: Record<string, unknown> = {
      user_id: userId,
      order_type: "course",
      course_id: courseRow.id,
      class_name: courseRow.title,
      total_amount: payment.amount,
      name: sanitize(metadata?.name as string),
      phone: sanitize(metadata?.phone as string) || "",
      payment_method: "portone",
      toss_order_id: payment.merchant_uid,
      toss_payment_key: payment.imp_uid,
      status: "completed",
      paid_at: paidAtIso,
    };

    const { data: courseOrder, error: orderError } = await adminClient
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single();

    if (orderError || !courseOrder) {
      const code = (orderError as { code?: string } | null)?.code;
      if (code === "23505") {
        const { data: existing2 } = await adminClient
          .from("orders")
          .select("id")
          .eq("toss_payment_key", payment.imp_uid)
          .maybeSingle();
        if (existing2) {
          return { ok: true, alreadyProcessed: true, orderId: existing2.id };
        }
      }
      return {
        ok: false,
        error: `주문 생성 실패: ${orderError?.message}`,
        status: 500,
      };
    }
    createdOrderId = courseOrder.id;

    /* 수강권 생성 — 구매일 + 1년 */
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const { error: enrollError } = await adminClient
      .from("course_enrollments")
      .upsert(
        {
          user_id: userId,
          course_id: courseRow.id,
          order_id: courseOrder.id,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "user_id,course_id" }
      );
    if (enrollError) {
      console.error("[수강권 생성 실패]", enrollError.message);
    }

    createdClassInfo = {
      className: courseRow.title,
      schedule: "온라인 강의 (수강기간 1년)",
    };
  } else if (isShopOrder) {
    const orderInsert: Record<string, unknown> = {
      user_id: isGuest ? null : userId,
      order_type: "shop",
      total_amount: payment.amount,
      coupon_code: appliedCouponCode,
      discount_amount: appliedDiscount,
      name: sanitize(metadata?.name as string),
      phone: sanitize(metadata?.phone as string),
      payment_method: "portone",
      toss_order_id: payment.merchant_uid,
      toss_payment_key: payment.imp_uid,
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
      const code = (orderError as { code?: string } | null)?.code;
      if (code === "23505") {
        // 동시 처리 race — 다른 경로가 먼저 INSERT 한 경우
        const { data: existing2 } = await adminClient
          .from("orders")
          .select("id")
          .eq("toss_payment_key", payment.imp_uid)
          .maybeSingle();
        if (existing2) {
          return { ok: true, alreadyProcessed: true, orderId: existing2.id };
        }
      }
      return {
        ok: false,
        error: `주문 생성 실패: ${orderError?.message}`,
        status: 500,
      };
    }
    createdOrderId = order.id;

    /* 쿠폰 사용 차감 — 결제는 이미 완료됐으므로 실패해도 주문은 유지 */
    if (appliedCouponId) {
      const redeemed = await redeemCoupon(adminClient, appliedCouponId);
      if (!redeemed) {
        console.warn(
          `[쿠폰] 차감 실패(소진 경합 가능) coupon=${appliedCouponCode} order=${order.id}`
        );
      }
    }

    /* order_items */
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
        .eq("user_id", userId!);
      products = (cartItems ?? [])
        .map((c) => c.product as unknown as ProductLite | null)
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

      if (!isGuest) {
        await adminClient.from("cart_items").delete().eq("user_id", userId!);
      }

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
    /* 클래스 주문 */
    const scheduleId = (metadata?.scheduleId as string) || null;

    if (scheduleId) {
      const { data: seatResult, error: seatError } = await adminClient.rpc(
        "decrement_schedule_seats",
        { p_schedule_id: scheduleId, p_quantity: 1 }
      );
      if (seatError) {
        console.error(
          `[좌석 차감 실패] schedule_id=${scheduleId}: ${seatError.message}`
        );
        return { ok: false, error: "좌석 차감 실패", status: 500 };
      }
      if (seatResult === false) {
        return {
          ok: false,
          error: "다른 수강생이 먼저 결제하여 자리가 마감되었습니다.",
          status: 409,
        };
      }
    }

    const orderData: Record<string, unknown> = {
      user_id: isGuest ? null : userId,
      order_type: "class",
      total_amount: payment.amount,
      class_name: sanitize(metadata?.className as string),
      schedule: sanitize(metadata?.schedule as string),
      name: sanitize(metadata?.name as string),
      phone: sanitize(metadata?.phone as string),
      experience_level: sanitize(metadata?.experienceLevel as string),
      message: sanitize(metadata?.message as string) || null,
      payment_method: "portone",
      toss_order_id: payment.merchant_uid,
      toss_payment_key: payment.imp_uid,
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
      const code = (orderError as { code?: string } | null)?.code;
      if (code === "23505") {
        // race: 좌석 복구 후 alreadyProcessed 응답
        if (scheduleId) {
          await adminClient
            .rpc("increment_schedule_seats", {
              p_schedule_id: scheduleId,
              p_quantity: 1,
            })
            .then(() => undefined, () => undefined);
        }
        const { data: existing2 } = await adminClient
          .from("orders")
          .select("id")
          .eq("toss_payment_key", payment.imp_uid)
          .maybeSingle();
        if (existing2) {
          return { ok: true, alreadyProcessed: true, orderId: existing2.id };
        }
      }
      return {
        ok: false,
        error: `주문 생성 실패: ${orderError?.message}`,
        status: 500,
      };
    }
    createdOrderId = classOrder.id;
    createdClassInfo = {
      className: sanitize(metadata?.className as string) || "",
      schedule: sanitize(metadata?.schedule as string) || "",
    };
  }

  /* ─── 3. 메일 발송 ─── */
  const customerName = sanitize(metadata?.name as string) || "이름 없음";

  try {
    if (isShopOrder) {
      const productNames = productsForEmail.map((p) => p.productName);
      await sendPaymentNotification({
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
      });
    } else {
      await sendPaymentNotification({
        orderType: "class",
        customerName,
        customerEmail: buyerEmail,
        customerPhone: buyerPhone,
        totalAmount: payment.amount,
        paymentMethod: "portone",
        className: createdClassInfo?.className || "",
        schedule: createdClassInfo?.schedule || "",
      });
    }
  } catch (notifyErr) {
    console.error("[portone-process] 관리자 알림 메일 발송 실패:", notifyErr);
  }

  let emailSent = false;
  let emailError: string | undefined;

  if (buyerEmail) {
    const orderNumber = payment.merchant_uid || createdOrderId || "";
    try {
      let result: EmailResult = { ok: false };
      if (isShopOrder) {
        result = await sendGuestPurchaseConfirmation({
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
      } else if (createdClassInfo) {
        result = await sendGuestPurchaseConfirmation({
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
      }
      emailSent = result.ok;
      emailError = result.error;
    } catch (err) {
      emailSent = false;
      emailError = err instanceof Error ? err.message : "email error";
      console.error("[processPortonePayment] 메일 발송 예외:", err);
    }
  }

  return {
    ok: true,
    alreadyProcessed: false,
    orderId: createdOrderId ?? undefined,
    emailSent,
    emailError,
  };
}

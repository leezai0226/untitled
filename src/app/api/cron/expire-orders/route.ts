import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendDepositReminder } from "@/utils/email";

/**
 * GET /api/cron/expire-orders  (Vercel Cron — 매시간)
 *
 * 계좌이체(pending) 주문 자동 관리:
 *  1) 12시간 경과 & 미입금 → 입금 안내 메일 1회 발송
 *  2) 24시간 경과 & 미입금 → 자동 취소 (+쿠폰 사용 횟수 복구)
 */

export const dynamic = "force-dynamic";

const REMIND_AFTER_H = 12;
const CANCEL_AFTER_H = 24;

function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* 주문의 이메일 주소: 비회원은 guest_email, 회원은 계정 이메일 */
async function resolveEmail(
  adminClient: ReturnType<typeof getAdminClient>,
  order: { user_id: string | null; guest_email: string | null }
): Promise<string | null> {
  if (order.guest_email) return order.guest_email;
  if (!order.user_id) return null;
  const { data } = await adminClient.auth.admin.getUserById(order.user_id);
  return data?.user?.email ?? null;
}

/* 주문 상품명 목록 */
async function resolveItems(
  adminClient: ReturnType<typeof getAdminClient>,
  order: { id: string; order_type: string | null; class_name: string | null }
): Promise<string[]> {
  if (order.order_type === "shop") {
    const { data: items } = await adminClient
      .from("order_items")
      .select("product:products(title)")
      .eq("order_id", order.id);
    const titles = (items ?? [])
      .map((it) => {
        const prod = it.product as unknown as
          | { title?: string }
          | { title?: string }[]
          | null;
        return Array.isArray(prod) ? prod[0]?.title : prod?.title;
      })
      .filter((t): t is string => !!t);
    if (titles.length > 0) return titles;
  }
  return [order.class_name || "주문 상품"];
}

/* 취소 시 쿠폰 사용 횟수 복구 */
async function restoreCoupon(
  adminClient: ReturnType<typeof getAdminClient>,
  order: { id: string; coupon_code: string | null }
) {
  if (!order.coupon_code) return;
  const { data: items } = await adminClient
    .from("order_items")
    .select("product_id")
    .eq("order_id", order.id);
  const productIds = (items ?? []).map((i) => i.product_id);
  if (productIds.length === 0) return;

  const { data: coupon } = await adminClient
    .from("product_coupons")
    .select("id, used_count")
    .eq("code", order.coupon_code)
    .in("product_id", productIds)
    .limit(1)
    .maybeSingle();

  if (coupon) {
    await adminClient
      .from("product_coupons")
      .update({ used_count: Math.max(0, (coupon.used_count as number) - 1) })
      .eq("id", coupon.id);
  }
}

export async function GET(request: NextRequest) {
  // Vercel Cron 인증 (CRON_SECRET 설정 시)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const adminClient = getAdminClient();
  const now = Date.now();
  const remindBefore = new Date(now - REMIND_AFTER_H * 3600_000).toISOString();
  const cancelBefore = new Date(now - CANCEL_AFTER_H * 3600_000).toISOString();

  let cancelled = 0;
  let reminded = 0;
  const errors: string[] = [];

  /* ── 1) 24시간 경과 → 자동 취소 ── */
  const { data: expiredOrders, error: expiredError } = await adminClient
    .from("orders")
    .select("id, coupon_code")
    .eq("payment_method", "bank_transfer")
    .eq("status", "pending")
    .lte("created_at", cancelBefore);

  if (expiredError) {
    errors.push(`만료 조회 실패: ${expiredError.message}`);
  } else {
    for (const order of expiredOrders ?? []) {
      const { error: cancelError } = await adminClient
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("status", "pending"); // 그 사이 입금확인된 주문 보호
      if (cancelError) {
        errors.push(`취소 실패 ${order.id}: ${cancelError.message}`);
        continue;
      }
      await restoreCoupon(adminClient, order);
      cancelled++;
    }
  }

  /* ── 2) 12시간 경과 (24시간 미만) → 입금 안내 메일 ── */
  const { data: remindOrders, error: remindError } = await adminClient
    .from("orders")
    .select("id, user_id, guest_email, name, depositor_name, total_amount, order_type, class_name, created_at")
    .eq("payment_method", "bank_transfer")
    .eq("status", "pending")
    .lte("created_at", remindBefore)
    .gt("created_at", cancelBefore)
    .is("reminder_sent_at", null);

  if (remindError) {
    errors.push(`리마인드 조회 실패: ${remindError.message}`);
  } else {
    for (const order of remindOrders ?? []) {
      const email = await resolveEmail(adminClient, order);
      if (!email) {
        // 이메일 없으면 재시도하지 않도록 마킹만
        await adminClient
          .from("orders")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", order.id);
        continue;
      }

      const items = await resolveItems(adminClient, order);
      const deadlineAt = new Date(
        new Date(order.created_at).getTime() + CANCEL_AFTER_H * 3600_000
      ).toISOString();

      const result = await sendDepositReminder({
        to: email,
        customerName: order.name || "고객",
        totalAmount: order.total_amount || 0,
        depositorName: order.depositor_name,
        items,
        orderedAt: order.created_at,
        deadlineAt,
      });

      if (result.ok) {
        await adminClient
          .from("orders")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", order.id);
        reminded++;
      } else {
        errors.push(`리마인드 발송 실패 ${order.id}: ${result.error}`);
      }
    }
  }

  console.log(
    `[cron/expire-orders] 취소 ${cancelled}건, 리마인드 ${reminded}건${errors.length ? `, 오류 ${errors.length}건` : ""}`
  );

  return NextResponse.json({ cancelled, reminded, errors });
}

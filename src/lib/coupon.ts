/**
 * 상품 쿠폰 서버 공용 로직
 *
 * 쿠폰은 상품 단위로 발급되며, 주문에 해당 상품이 포함되어 있을 때만 적용된다.
 * 모든 검증·차감은 service_role 로만 수행한다 (클라이언트에는 코드 목록 비노출).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CouponRow {
  id: string;
  product_id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
}

export interface CouponApplication {
  coupon: CouponRow;
  /** 할인 대상 상품 id */
  productId: string;
  /** 실제 차감 금액 (상품가 초과 불가) */
  discountAmount: number;
}

/** 코드 정규화: 공백 제거 + 대문자 */
export function normalizeCouponCode(raw: string): string {
  return (raw || "").trim().toUpperCase();
}

/** 상품 하나에 대한 할인액 계산 (상품가를 넘지 않음) */
export function calcDiscount(coupon: CouponRow, price: number): number {
  const amount =
    coupon.discount_type === "percent"
      ? Math.floor((price * coupon.discount_value) / 100)
      : coupon.discount_value;
  return Math.max(0, Math.min(price, amount));
}

/**
 * 주문 상품 목록에 쿠폰 적용을 시도한다.
 * 성공: CouponApplication / 실패: 사유 문자열
 */
export async function findApplicableCoupon(
  adminClient: SupabaseClient,
  rawCode: string,
  products: { id: string; price: number }[]
): Promise<CouponApplication | { error: string }> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { error: "쿠폰 코드를 입력해 주세요." };

  const productIds = products.map((p) => p.id);
  const { data: coupons, error } = await adminClient
    .from("product_coupons")
    .select("*")
    .eq("code", code)
    .in("product_id", productIds);

  if (error) return { error: "쿠폰 조회에 실패했습니다." };
  if (!coupons || coupons.length === 0) {
    return { error: "이 주문에 사용할 수 없는 쿠폰입니다." };
  }

  // 같은 코드가 여러 상품에 걸릴 수 있으므로 사용 가능한 첫 쿠폰 선택
  for (const c of coupons as CouponRow[]) {
    if (!c.is_active) continue;
    if (c.max_uses !== null && c.used_count >= c.max_uses) continue;
    const product = products.find((p) => p.id === c.product_id);
    if (!product) continue;
    return {
      coupon: c,
      productId: c.product_id,
      discountAmount: calcDiscount(c, product.price),
    };
  }

  // 존재하지만 소진/비활성
  const exhausted = (coupons as CouponRow[]).some(
    (c) => c.max_uses !== null && c.used_count >= c.max_uses
  );
  return {
    error: exhausted
      ? "쿠폰이 모두 소진되었습니다."
      : "사용할 수 없는 쿠폰입니다.",
  };
}

/**
 * 쿠폰 사용 1회 차감 (원자적).
 * 소진 등으로 실패하면 false — 결제 완료 후 호출되는 경로에서는
 * 주문을 막지 않고 로그만 남기는 것을 권장.
 */
export async function redeemCoupon(
  adminClient: SupabaseClient,
  couponId: string
): Promise<boolean> {
  const { data, error } = await adminClient.rpc("redeem_coupon", {
    p_coupon_id: couponId,
  });
  if (error) {
    console.error("[coupon] redeem 실패:", error.message);
    return false;
  }
  return data === true;
}

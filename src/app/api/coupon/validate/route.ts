import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createRateLimiter } from "@/utils/rateLimit";
import { findApplicableCoupon } from "@/lib/coupon";
import { isUpcoming } from "@/utils/release";

/**
 * POST /api/coupon/validate
 * body: { code: string, productIds: string[] }
 *
 * 주문 예정 상품들에 쿠폰이 적용 가능한지 검증하고 할인액을 계산한다.
 * 여기서는 차감하지 않는다 — 실제 차감은 결제 확정 시점(서버)에서 수행.
 */

// 코드 무차별 대입 방지
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const { code, productIds } = (await request.json()) as {
    code?: string;
    productIds?: string[];
  };

  if (!code?.trim() || !Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json(
      { error: "쿠폰 코드와 상품 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: products, error } = await adminClient
    .from("products")
    .select("id, title, price, release_at, release_mode")
    .in("id", productIds);

  if (error || !products || products.length === 0) {
    return NextResponse.json(
      { error: "상품 정보를 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  // 오픈 전 상품이 섞여 있으면 쿠폰 검증 자체를 거부
  if (products.some((p) => isUpcoming(p))) {
    return NextResponse.json(
      { error: "아직 판매가 시작되지 않은 상품이 있습니다." },
      { status: 400 }
    );
  }

  const result = await findApplicableCoupon(adminClient, code, products);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const target = products.find((p) => p.id === result.productId);

  return NextResponse.json({
    valid: true,
    code: result.coupon.code,
    productId: result.productId,
    productTitle: target?.title ?? "",
    discountType: result.coupon.discount_type,
    discountValue: result.coupon.discount_value,
    discountAmount: result.discountAmount,
  });
}

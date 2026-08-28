import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizeCouponCode } from "@/lib/coupon";

// 관리자 상품 API: 1분에 30회 제한
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

/* ── 쿠폰 페이로드 → DB 동기화 ──
 * 폼에서 넘어온 배열 기준으로 수정/추가하고, 빠진 쿠폰은 삭제한다.
 * used_count 는 절대 덮어쓰지 않는다.
 */
interface CouponInput {
  id?: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  is_active?: boolean;
}

async function syncCoupons(productId: string, raw: unknown): Promise<string | null> {
  if (!Array.isArray(raw)) return null;

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 입력 정리 + 검증
  const items: CouponInput[] = [];
  for (const c of raw as CouponInput[]) {
    const code = normalizeCouponCode(c?.code ?? "");
    if (!code) continue;
    const type = c.discount_type === "fixed" ? "fixed" : "percent";
    const value = Math.floor(Number(c.discount_value) || 0);
    if (value <= 0) return `쿠폰 ${code}: 할인 값을 입력해 주세요.`;
    if (type === "percent" && value > 100)
      return `쿠폰 ${code}: 할인율은 100%를 넘을 수 없습니다.`;
    const maxUses =
      c.max_uses === null || c.max_uses === undefined || c.max_uses === ("" as unknown)
        ? null
        : Math.max(1, Math.floor(Number(c.max_uses)));
    items.push({
      id: c.id,
      code,
      discount_type: type,
      discount_value: value,
      max_uses: maxUses,
      is_active: c.is_active !== false,
    });
  }

  // 코드 중복 검사 (같은 상품 내)
  const codes = items.map((i) => i.code);
  if (new Set(codes).size !== codes.length) {
    return "같은 코드의 쿠폰이 중복되었습니다.";
  }

  const { data: existing } = await adminClient
    .from("product_coupons")
    .select("id")
    .eq("product_id", productId);
  const keepIds = new Set(items.filter((i) => i.id).map((i) => i.id));

  // 폼에서 사라진 쿠폰 삭제
  const toDelete = (existing ?? []).filter((e) => !keepIds.has(e.id));
  if (toDelete.length > 0) {
    await adminClient
      .from("product_coupons")
      .delete()
      .in("id", toDelete.map((e) => e.id));
  }

  for (const item of items) {
    if (item.id) {
      const { error } = await adminClient
        .from("product_coupons")
        .update({
          code: item.code,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          max_uses: item.max_uses,
          is_active: item.is_active,
        })
        .eq("id", item.id)
        .eq("product_id", productId);
      if (error) return `쿠폰 저장 실패: ${error.message}`;
    } else {
      const { error } = await adminClient.from("product_coupons").insert({
        product_id: productId,
        code: item.code,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        max_uses: item.max_uses,
        is_active: item.is_active,
      });
      if (error) return `쿠폰 저장 실패: ${error.message}`;
    }
  }
  return null;
}

/* ── POST: 상품 등록 ── */
export async function POST(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const supabase = await createClient();

    const insertData: Record<string, unknown> = {
      title: sanitize(body.title),
      type: "digital_asset",
      category: sanitize(body.category),
      price: Number(body.price) || 0,
      description: sanitize(body.description),
      thumbnail_url: body.thumbnail_url || null,
      detail_images: body.detail_images || [],
      file_url: body.file_url || null,
      faqs: Array.isArray(body.faqs) ? body.faqs : [],
      refund_policy: Array.isArray(body.refund_policy) ? body.refund_policy : [],
      slider_media: Array.isArray(body.slider_media)
        ? body.slider_media.filter(
            (m: unknown): m is { url: string; type: string } =>
              !!m &&
              typeof m === "object" &&
              typeof (m as { url?: unknown }).url === "string" &&
              ((m as { type?: unknown }).type === "image" ||
                (m as { type?: unknown }).type === "video")
          )
        : [],
    };

    // remaining_seats: null = 무제한, 숫자 = 잔여 수량
    if (body.remaining_seats !== undefined) {
      insertData.remaining_seats =
        body.remaining_seats === null ? null : Number(body.remaining_seats);
    }

    // 예약 오픈: release_at 이 지나야 구매 가능 (null = 즉시 판매)
    insertData.release_at = body.release_at || null;
    insertData.release_mode =
      body.release_mode === "hidden" ? "hidden" : "teaser";

    const { data: created, error } = await supabase
      .from("products")
      .insert(insertData)
      .select("id")
      .single();

    if (error || !created) {
      return NextResponse.json(
        { error: `상품 등록 실패: ${error?.message}` },
        { status: 500 }
      );
    }

    // 쿠폰 동기화
    const couponError = await syncCoupons(created.id, body.coupons);
    if (couponError) {
      return NextResponse.json(
        { error: couponError, productId: created.id },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, productId: created.id });
  } catch (err: unknown) {
    console.error("POST /api/admin/products 에러:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "서버 내부 오류" },
      { status: 500 }
    );
  }
}

/* ── PUT: 상품 수정 ── */
export async function PUT(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;

    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
    }

    const supabase = await createClient();

    // 허용된 필드만 업데이트 (임의 필드 주입 방지)
    const updateData: Record<string, unknown> = {};

    if (fields.title !== undefined) updateData.title = sanitize(fields.title);
    if (fields.category !== undefined) updateData.category = sanitize(fields.category);
    if (fields.price !== undefined) updateData.price = Number(fields.price);
    if (fields.description !== undefined) updateData.description = sanitize(fields.description);
    if (fields.thumbnail_url !== undefined) updateData.thumbnail_url = fields.thumbnail_url;
    if (fields.detail_images !== undefined) updateData.detail_images = fields.detail_images;
    if (fields.file_url !== undefined) updateData.file_url = fields.file_url;
    if (fields.sort_order !== undefined) updateData.sort_order = Number(fields.sort_order);
    if (fields.release_at !== undefined) updateData.release_at = fields.release_at || null;
    if (fields.release_mode !== undefined)
      updateData.release_mode = fields.release_mode === "hidden" ? "hidden" : "teaser";
    if (fields.faqs !== undefined) updateData.faqs = Array.isArray(fields.faqs) ? fields.faqs : [];
    if (fields.refund_policy !== undefined) updateData.refund_policy = Array.isArray(fields.refund_policy) ? fields.refund_policy : [];
    if (fields.slider_media !== undefined) {
      updateData.slider_media = Array.isArray(fields.slider_media)
        ? fields.slider_media.filter(
            (m: unknown): m is { url: string; type: string } =>
              !!m &&
              typeof m === "object" &&
              typeof (m as { url?: unknown }).url === "string" &&
              ((m as { type?: unknown }).type === "image" ||
                (m as { type?: unknown }).type === "video")
          )
        : [];
    }
    if (fields.remaining_seats !== undefined) {
      updateData.remaining_seats =
        fields.remaining_seats === null ? null : Number(fields.remaining_seats);
    }

    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: `상품 수정 실패: ${error.message}` },
        { status: 500 }
      );
    }

    // 쿠폰 동기화 (coupons 필드가 온 경우에만)
    if (fields.coupons !== undefined) {
      const couponError = await syncCoupons(id, fields.coupons);
      if (couponError) {
        return NextResponse.json({ error: couponError }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PUT /api/admin/products 에러:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "서버 내부 오류" },
      { status: 500 }
    );
  }
}

/* ── DELETE: 상품 삭제 ── */
export async function DELETE(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `상품 삭제 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

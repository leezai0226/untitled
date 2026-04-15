import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";

// 관리자 상품 API: 1분에 30회 제한
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

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

    const { error } = await supabase.from("products").insert(insertData);

    if (error) {
      return NextResponse.json(
        { error: `상품 등록 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
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

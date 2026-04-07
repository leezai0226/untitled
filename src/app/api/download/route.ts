import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createRateLimiter } from "@/utils/rateLimit";

const DOWNLOAD_DAYS = 30;
const SIGNED_URL_EXPIRES = 60; // 60초

// 다운로드 API: 1분에 10회 제한
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });

export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const { productId } = await request.json();

  if (!productId) {
    return NextResponse.json(
      { error: "상품 ID가 누락되었습니다." },
      { status: 400 }
    );
  }

  /* ══════════════════════════════════════════════════════
   * 1️⃣  로그인 확인
   * ══════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════
   * 2️⃣  구매 이력 검증
   *     - status: 'completed' (결제 완료)
   *     - 결제일로부터 30일 이내
   * ══════════════════════════════════════════════════════ */

  const { data: orderItems, error: queryError } = await supabase
    .from("order_items")
    .select(`
      id,
      product_id,
      order:orders!inner(
        id,
        user_id,
        status,
        paid_at,
        created_at
      )
    `)
    .eq("product_id", productId);

  if (queryError) {
    return NextResponse.json(
      { error: "구매 이력 조회에 실패했습니다." },
      { status: 500 }
    );
  }

  // 본인의 completed 주문 찾기
  const validItem = orderItems?.find((item) => {
    const order = item.order as unknown as {
      user_id: string;
      status: string;
      paid_at: string | null;
      created_at: string;
    };
    return order.user_id === user.id && order.status === "completed";
  });

  if (!validItem) {
    return NextResponse.json(
      { error: "이 상품을 구매한 이력이 없습니다." },
      { status: 403 }
    );
  }

  // 30일 만료 체크
  const order = validItem.order as unknown as {
    paid_at: string | null;
    created_at: string;
  };
  const baseDate = order.paid_at
    ? new Date(order.paid_at)
    : new Date(order.created_at);
  const expiry = new Date(baseDate);
  expiry.setDate(expiry.getDate() + DOWNLOAD_DAYS);

  if (new Date() > expiry) {
    return NextResponse.json(
      { error: "다운로드 기한이 만료되었습니다. (결제일로부터 30일 초과)" },
      { status: 403 }
    );
  }

  /* ══════════════════════════════════════════════════════
   * 3️⃣  상품의 file_url 조회
   * ══════════════════════════════════════════════════════ */

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("file_url")
    .eq("id", productId)
    .single();

  if (productError || !product?.file_url) {
    return NextResponse.json(
      { error: "다운로드 파일이 준비되지 않았습니다." },
      { status: 404 }
    );
  }

  /* ══════════════════════════════════════════════════════
   * 4️⃣  Service Role Key로 Signed URL 발급 (60초 유효)
   *     RLS를 우회하여 private 버킷 파일에 접근
   * ══════════════════════════════════════════════════════ */

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "서버 설정 오류: Service Role Key가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

  const { data: signedData, error: signedError } = await adminClient.storage
    .from("shop-files")
    .createSignedUrl(product.file_url, SIGNED_URL_EXPIRES, {
      download: true,
    });

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: `Signed URL 생성 실패: ${signedError?.message || "알 수 없는 오류"}` },
      { status: 500 }
    );
  }

  /* ══════════════════════════════════════════════════════
   * 5️⃣  다운로드 시각 기록 (최초 다운로드 시에만)
   *     downloaded_at이 기록되면 환불 불가
   * ══════════════════════════════════════════════════════ */
  const orderItemId = validItem.id;
  const downloadedAt = new Date().toISOString();

  const { error: updateError } = await adminClient
    .from("order_items")
    .update({ downloaded_at: downloadedAt })
    .eq("id", orderItemId)
    .is("downloaded_at", null);

  if (updateError) {
    console.error("[다운로드 기록 실패]", updateError.message);
    // 기록 실패해도 다운로드는 허용하되, 로그로 추적
  }

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    downloaded_at: downloadedAt,
  });
}

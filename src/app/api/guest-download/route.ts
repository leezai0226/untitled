import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createRateLimiter } from "@/utils/rateLimit";

const DOWNLOAD_DAYS = 30;
const SIGNED_URL_EXPIRES = 60; // 60초

// 게스트 다운로드: 1분에 20회 제한 (토큰만 알면 접근 가능하므로 약간 타이트하게)
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

/**
 * GET /api/guest-download?token=<uuid>
 *
 * 비회원이 구매 확인 메일의 링크를 통해 상품을 다운로드하기 위한 엔드포인트.
 * - order_items.download_token (UUID)을 열쇠로 사용
 * - 결제일로부터 30일 내에만 유효
 * - 성공 시 Supabase Signed URL로 302 리다이렉트
 */
export async function GET(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return htmlError("잘못된 요청입니다. 다운로드 토큰이 없습니다.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return htmlError("서버 설정 오류가 발생했습니다.", 500);
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

  /* ── 토큰으로 order_item 조회 ── */
  const { data: item, error: itemError } = await adminClient
    .from("order_items")
    .select(
      `
      id,
      product_id,
      downloaded_at,
      refunded_at,
      order:orders!inner(
        id,
        status,
        paid_at,
        created_at
      )
    `
    )
    .eq("download_token", token)
    .single();

  if (itemError || !item) {
    return htmlError(
      "다운로드 링크가 유효하지 않거나 만료되었습니다. 구매 내역을 확인해 주세요.",
      404
    );
  }

  const order = item.order as unknown as {
    id: string;
    status: string;
    paid_at: string | null;
    created_at: string;
  };

  if (order.status !== "completed") {
    return htmlError(
      "결제가 확정되지 않은 주문입니다. 결제 또는 입금 확인 후 다시 시도해 주세요.",
      403
    );
  }

  if (item.refunded_at) {
    return htmlError("환불된 상품은 다운로드할 수 없습니다.", 403);
  }

  /* ── 30일 만료 체크 ── */
  const baseDate = order.paid_at
    ? new Date(order.paid_at)
    : new Date(order.created_at);
  const expiry = new Date(baseDate);
  expiry.setDate(expiry.getDate() + DOWNLOAD_DAYS);

  if (new Date() > expiry) {
    return htmlError(
      "다운로드 기한이 만료되었습니다. (결제일로부터 30일 초과)",
      403
    );
  }

  /* ── 상품 file_url 조회 ── */
  const { data: product, error: productError } = await adminClient
    .from("products")
    .select("file_url, title")
    .eq("id", item.product_id)
    .single();

  if (productError || !product?.file_url) {
    return htmlError("다운로드 파일이 준비되지 않았습니다.", 404);
  }

  /* ── Signed URL 발급 ── */
  const { data: signedData, error: signedError } = await adminClient.storage
    .from("shop-files")
    .createSignedUrl(product.file_url, SIGNED_URL_EXPIRES, {
      download: true,
    });

  if (signedError || !signedData?.signedUrl) {
    return htmlError(
      `다운로드 URL 생성 실패: ${signedError?.message || "알 수 없는 오류"}`,
      500
    );
  }

  /* ── 다운로드 시각 기록 (최초 1회) ── */
  if (!item.downloaded_at) {
    const nowIso = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("order_items")
      .update({ downloaded_at: nowIso })
      .eq("id", item.id)
      .is("downloaded_at", null);

    if (updateError) {
      console.error("[게스트 다운로드 기록 실패]", updateError.message);
    }
  }

  /* ── Signed URL로 리다이렉트 ── */
  return NextResponse.redirect(signedData.signedUrl, 302);
}

/**
 * 사람이 읽을 수 있는 에러 페이지를 반환 (브라우저에서 링크 클릭 시).
 */
function htmlError(message: string, status: number) {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>다운로드 오류</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: #0a0a0a;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .box {
      max-width: 440px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
    }
    .icon {
      font-size: 40px;
      margin-bottom: 16px;
    }
    h1 {
      color: #ff6b6b;
      font-size: 18px;
      margin: 0 0 12px;
    }
    p {
      color: #ccc;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    a {
      display: inline-block;
      background: #c8a2ff;
      color: #0a0a0a;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">⚠️</div>
    <h1>다운로드에 실패했습니다</h1>
    <p>${message}</p>
    <a href="/">← 홈으로 돌아가기</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

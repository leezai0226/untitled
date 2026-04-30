import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createRateLimiter } from "@/utils/rateLimit";
import { getPaymentInfo, parseCustomData } from "@/lib/portone-api";
import { processPortonePayment } from "@/lib/portone-process";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });

/* 요청에서 베이스 URL 추출 (이메일 링크용) */
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
 *
 * 모바일 redirect 흐름(/checkout/verify-redirect)에서 sessionStorage가
 * 비어 metadata가 빠진 경우, PortOne 결제정보의 custom_data로 폴백합니다.
 *
 * Webhook과 동일한 처리 로직을 src/lib/portone-process.ts에서 공유합니다.
 * 동일 imp_uid에 대한 중복 호출은 멱등 처리됩니다.
 * ═══════════════════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;

    const body = await request.json();
    const { imp_uid, merchant_uid } = body as {
      imp_uid?: string;
      merchant_uid?: string;
    };
    let metadata: Record<string, unknown> =
      (body?.metadata as Record<string, unknown>) ?? {};

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

    /* ── 포트원 결제 검증 ── */
    const payment = await getPaymentInfo(imp_uid);

    if (payment.status !== "paid") {
      return NextResponse.json(
        { error: `결제가 완료되지 않았습니다. (상태: ${payment.status})` },
        { status: 400 }
      );
    }

    /* ── metadata 보강: 비어 있으면 custom_data로 폴백 ── */
    const hasMeaningfulMeta =
      metadata && Object.keys(metadata).length > 0 && !!metadata.orderType;
    if (!hasMeaningfulMeta) {
      const fromCustom = parseCustomData(payment.custom_data);
      metadata = { ...fromCustom, ...metadata };
    }

    /* ── 비회원 필수 정보 검증 ── */
    const isGuest = !user;
    if (isGuest) {
      const guestEmail = ((metadata?.guestEmail as string) || "").trim();
      const guestPhone = ((metadata?.guestPhone as string) || "").trim();
      const isShopOrder = metadata?.orderType === "shop";
      // 샵 주문은 연락처 불필요 (현금영수증란에만 입력)
      if (!guestEmail || (!isShopOrder && !guestPhone)) {
        return NextResponse.json(
          {
            error:
              "비회원 결제의 경우 이메일과 연락처가 필요합니다. 결제 정보를 확인해 주세요.",
          },
          { status: 400 }
        );
      }
      if (!/^\S+@\S+\.\S+$/.test(guestEmail)) {
        return NextResponse.json(
          { error: "유효한 이메일 주소가 아닙니다." },
          { status: 400 }
        );
      }
    }

    /* ── 공통 결제 처리 ── */
    const result = await processPortonePayment({
      payment: {
        imp_uid: payment.imp_uid,
        merchant_uid: payment.merchant_uid,
        amount: payment.amount,
      },
      metadata,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      baseUrl: resolveBaseUrl(request),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "결제 처리 실패" },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json({
      success: true,
      guest: isGuest,
      payment,
      orderId: result.orderId,
      alreadyProcessed: result.alreadyProcessed ?? false,
      emailSent: result.emailSent ?? false,
      emailError: result.emailError,
    });
  } catch (err: unknown) {
    console.error("POST /api/portone/verify 에러:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "서버 내부 오류" },
      { status: 500 }
    );
  }
}

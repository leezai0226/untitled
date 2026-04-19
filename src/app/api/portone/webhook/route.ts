import { NextRequest, NextResponse } from "next/server";
import { getPaymentInfo, parseCustomData } from "@/lib/portone-api";
import { processPortonePayment } from "@/lib/portone-process";

/**
 * POST /api/portone/webhook
 *
 * PortOne 결제 완료 시 서버로 직접 들어오는 웹훅.
 *
 * 사용자 페이지가 결제 후 callback이 누락되더라도(모바일 redirect 실패 등)
 * 이 webhook이 호출되면서 주문이 DB에 기록되고 메일이 발송됩니다.
 *
 * 보안:
 *  - PortOne V1은 별도 시크릿 서명이 없으므로,
 *    수신한 imp_uid를 우리의 PortOne 키로 다시 조회해 검증합니다.
 *    (위변조된 임의 imp_uid는 PortOne API 조회에서 실패함)
 *
 * 멱등성:
 *  - 동일 imp_uid의 주문이 이미 DB에 있으면 중복 INSERT 없이 바로 반환합니다.
 *
 * PortOne 콘솔 → Webhook 설정 URL 예시:
 *   https://www.untitled-studio.kr/api/portone/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const impUid: string | undefined = body?.imp_uid;
    const merchantUid: string | undefined = body?.merchant_uid;
    const status: string | undefined = body?.status;

    if (!impUid || !merchantUid) {
      console.warn("[portone webhook] imp_uid/merchant_uid 누락", body);
      return NextResponse.json(
        { error: "imp_uid/merchant_uid 누락" },
        { status: 400 }
      );
    }

    // 결제 완료 상태가 아니면 무시(예: ready 상태)
    if (status && status !== "paid") {
      console.log(
        `[portone webhook] status=${status} — 처리하지 않고 ack 응답 (imp_uid=${impUid})`
      );
      return NextResponse.json({ ok: true, ignored: true, status });
    }

    /* ── 결제 재조회로 위변조 검증 ── */
    const payment = await getPaymentInfo(impUid);

    if (payment.status !== "paid") {
      console.log(
        `[portone webhook] PortOne 조회 결과 미결제 — status=${payment.status} (imp_uid=${impUid})`
      );
      return NextResponse.json({ ok: true, ignored: true, status: payment.status });
    }

    /* ── custom_data 에서 metadata + userId 복원 ── */
    const customData = parseCustomData(payment.custom_data);
    const userId = (customData.userId as string | null) ?? null;
    const userEmail = (customData.userEmail as string | null) ?? null;

    // userId/userEmail은 metadata에서 분리해서 보관
    delete customData.userId;
    delete customData.userEmail;

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      `https://${request.headers.get("host") ?? "www.untitled-studio.kr"}`;

    const result = await processPortonePayment({
      payment: {
        imp_uid: payment.imp_uid,
        merchant_uid: payment.merchant_uid,
        amount: payment.amount,
      },
      metadata: customData,
      userId,
      userEmail,
      baseUrl,
    });

    if (!result.ok) {
      console.error(
        `[portone webhook] 처리 실패 imp_uid=${impUid} — ${result.error}`
      );
      // PortOne 에 200 으로 응답해 무한 재시도 방지하되, 본문에 에러를 남김
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 200 }
      );
    }

    if (result.alreadyProcessed) {
      console.log(
        `[portone webhook] 이미 처리된 결제 imp_uid=${impUid} — skip`
      );
    } else {
      console.log(
        `[portone webhook] 신규 처리 완료 imp_uid=${impUid} order=${result.orderId} mail=${result.emailSent}`
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      alreadyProcessed: result.alreadyProcessed ?? false,
      emailSent: result.emailSent ?? false,
    });
  } catch (err) {
    console.error("[portone webhook] 예외:", err);
    // PortOne 의 무한 재시도를 막기 위해 200 으로 반환
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 200 }
    );
  }
}

/* PortOne가 GET으로 헬스체크 시 200 응답 */
export async function GET() {
  return NextResponse.json({ ok: true, name: "portone-webhook" });
}

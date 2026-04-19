import { Resend } from "resend";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "untitled.mooje@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/* ── 이메일 발송 공통 결과 타입 ── */
export interface EmailResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

interface PaymentNotification {
  orderType: "shop" | "class";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  items?: string[];       // 샵 주문: 상품명 목록
  className?: string;     // 클래스 주문
  schedule?: string;      // 클래스 주문
}

/**
 * 관리자에게 결제 완료 알림 이메일을 발송합니다.
 */
export async function sendPaymentNotification(
  data: PaymentNotification
): Promise<EmailResult> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn("[이메일] RESEND_API_KEY가 설정되지 않아 이메일 발송을 건너뜁니다.");
      return { ok: false, error: "RESEND_API_KEY missing" };
    }

    const isClass = data.orderType === "class";
    const paymentLabel =
      data.paymentMethod === "portone"
        ? "신용카드 (KG이니시스)"
        : data.paymentMethod === "bank_transfer"
          ? "계좌이체"
          : data.paymentMethod;

    const itemsHtml = isClass
      ? `<tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">클래스</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.className || "-"}</td></tr>
         <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">일정</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.schedule || "-"}</td></tr>`
      : (data.items || [])
          .map(
            (name) =>
              `<tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">상품</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${name}</td></tr>`
          )
          .join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;color:#fff;">
        <h2 style="margin:0 0 24px;color:#c8a2ff;">
          ${isClass ? "🎬 새로운 클래스 수강신청" : "🛒 새로운 디지털 에셋 주문"}이 들어왔습니다!
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">주문자</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.customerName}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">이메일</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.customerEmail}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">연락처</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.customerPhone}</td></tr>
          ${itemsHtml}
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">결제 금액</td><td style="padding:8px 12px;border:1px solid #333;color:#c8a2ff;font-weight:bold;">₩${data.totalAmount.toLocaleString("ko-KR")}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">결제 수단</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${paymentLabel}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin:0;">이 메일은 자동 발송된 알림입니다.</p>
      </div>
    `;

    const { data: sent, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[untitled-studio] ${isClass ? "클래스 수강신청" : "디지털 에셋 주문"} — ${data.customerName} / ₩${data.totalAmount.toLocaleString("ko-KR")}`,
      html,
    });

    if (sendError) {
      console.error("[이메일] 관리자 알림 발송 실패:", sendError);
      return { ok: false, error: sendError.message || "Resend error" };
    }

    console.log(
      `[이메일] 관리자 결제 알림 발송 완료 (id=${sent?.id ?? "unknown"})`
    );
    return { ok: true, messageId: sent?.id };
  } catch (err) {
    // 이메일 실패가 결제 플로우를 막지 않도록 에러만 로깅
    console.error("[이메일 발송 실패]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/* ───────────────────────────── 환불 알림 ───────────────────────────── */

interface RefundNotification {
  orderType: "shop" | "class";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  refundAmount: number;
  refundRate: number;         // 50 또는 100
  paymentMethod: string;
  className?: string;         // 클래스
  schedule?: string;          // 클래스
  productName?: string;       // 샵
}

/**
 * 관리자에게 환불 완료 알림 이메일을 발송합니다.
 */
export async function sendRefundNotification(
  data: RefundNotification
): Promise<EmailResult> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn("[이메일] RESEND_API_KEY가 설정되지 않아 이메일 발송을 건너뜁니다.");
      return { ok: false, error: "RESEND_API_KEY missing" };
    }

    const isClass = data.orderType === "class";
    const paymentLabel =
      data.paymentMethod === "portone"
        ? "신용카드 (KG이니시스)"
        : data.paymentMethod === "bank_transfer"
          ? "계좌이체"
          : data.paymentMethod;

    const refundLabel = data.refundRate === 100 ? "전액 환불" : `${data.refundRate}% 부분 환불`;

    const detailHtml = isClass
      ? `<tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">클래스</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.className || "-"}</td></tr>
         <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">일정</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.schedule || "-"}</td></tr>`
      : `<tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">상품</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.productName || "디지털 에셋"}</td></tr>`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;color:#fff;">
        <h2 style="margin:0 0 24px;color:#ff6b6b;">
          ${isClass ? "🎬 클래스 환불 완료" : "🛒 디지털 에셋 환불 완료"}
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">주문자</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.customerName}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">이메일</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.customerEmail}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">연락처</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.customerPhone}</td></tr>
          ${detailHtml}
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">환불 유형</td><td style="padding:8px 12px;border:1px solid #333;color:#ff6b6b;font-weight:bold;">${refundLabel}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">환불 금액</td><td style="padding:8px 12px;border:1px solid #333;color:#ff6b6b;font-weight:bold;">₩${data.refundAmount.toLocaleString("ko-KR")}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">결제 수단</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${paymentLabel}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin:0;">이 메일은 자동 발송된 알림입니다.</p>
      </div>
    `;

    const { data: sent, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[untitled-studio] 환불 완료 — ${data.customerName} / ₩${data.refundAmount.toLocaleString("ko-KR")}`,
      html,
    });

    if (sendError) {
      console.error("[이메일] 환불 알림 발송 실패:", sendError);
      return { ok: false, error: sendError.message || "Resend error" };
    }

    console.log(
      `[이메일] 관리자 환불 알림 발송 완료 (id=${sent?.id ?? "unknown"})`
    );
    return { ok: true, messageId: sent?.id };
  } catch (err) {
    console.error("[이메일 환불 알림 발송 실패]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/* ───────────────────────────── 비회원 구매 확인 ───────────────────────────── */

/* ───────────────────────────── 무통장 입금 접수 확인 ───────────────────────────── */

interface BankTransferReceivedData {
  kind: "shop" | "class";
  to: string;
  customerName: string;
  totalAmount: number;
  orderNumber: string;
  items?: string[];       // shop: 상품명 목록
  className?: string;     // class
  schedule?: string;      // class
}

const BANK_INFO = "카카오뱅크 3333-28-7160406 (예금주: 이영재)";

/**
 * 비회원 무통장 입금 신청 직후 구매자에게 "접수 확인" 메일을 발송합니다.
 * 입금 확인 후 별도로 다운로드 링크 / 수강 안내 메일이 발송됩니다.
 */
export async function sendBankTransferReceived(
  data: BankTransferReceivedData
): Promise<EmailResult> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn("[이메일] RESEND_API_KEY 없음 — 접수 확인 메일 건너뜀");
      return { ok: false, error: "RESEND_API_KEY missing" };
    }

    const isClass = data.kind === "class";
    const subject = isClass
      ? `[untitled-studio] 수강신청 접수 확인 (주문번호: ${data.orderNumber})`
      : `[untitled-studio] 주문 접수 확인 (주문번호: ${data.orderNumber})`;

    const itemsHtml = isClass
      ? `<tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">클래스</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.className || "-"}</td></tr>
         <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">일정</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${data.schedule || "-"}</td></tr>`
      : (data.items || [])
          .map(
            (name) =>
              `<tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">상품</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">${name}</td></tr>`
          )
          .join("");

    const nextStep = isClass
      ? "입금 확인 후 이메일로 수강 안내 메일이 발송됩니다."
      : "입금 확인 후 이메일로 다운로드 링크가 발송됩니다.";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;color:#fff;">
        <h2 style="margin:0 0 20px;color:#c8a2ff;">⏳ ${isClass ? "수강신청이" : "주문이"} 접수되었습니다!</h2>
        <p style="margin:0 0 16px;color:#fff;line-height:1.6;">
          ${data.customerName} 님, ${isClass ? "수강신청" : "주문"}해 주셔서 감사합니다.<br/>
          아래 계좌로 입금해 주시면 확인 후 안내드립니다.
        </p>

        <div style="background:#1f1a2e;border:1px solid #c8a2ff44;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;color:#c8a2ff;font-weight:600;">💳 입금 계좌</p>
          <p style="margin:0;color:#fff;font-size:15px;font-weight:600;">${BANK_INFO}</p>
          <p style="margin:8px 0 0;color:#aaa;font-size:13px;">입금 금액: <span style="color:#c8a2ff;font-weight:bold;">₩${data.totalAmount.toLocaleString("ko-KR")}</span></p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          ${itemsHtml}
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">결제 금액</td><td style="padding:8px 12px;border:1px solid #333;color:#c8a2ff;font-weight:bold;">₩${data.totalAmount.toLocaleString("ko-KR")}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">결제 수단</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;">계좌이체 (무통장입금)</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #333;color:#ccc;">주문 번호</td><td style="padding:8px 12px;border:1px solid #333;color:#fff;font-family:monospace;">${data.orderNumber}</td></tr>
        </table>

        <div style="background:#0f0f0f;border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0;color:#aaa;font-size:13px;line-height:1.7;">
            📌 ${nextStep}<br/>
            영업일 기준 1~2일 내 처리됩니다.
          </p>
        </div>

        <p style="margin:12px 0 0;color:#666;font-size:11px;">
          문의: untitled.mooje@gmail.com<br/>
          이 메일은 자동 발송된 알림입니다.
        </p>
      </div>
    `;

    const { data: sent, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject,
      html,
    });

    if (sendError) {
      console.error(`[이메일] 접수 확인 메일 발송 실패 → ${data.to}`, JSON.stringify(sendError, null, 2));
      return { ok: false, error: sendError.message || "Resend error" };
    }

    console.log(`[이메일] 접수 확인 메일 발송 완료 → ${data.to} (id=${sent?.id ?? "unknown"})`);
    return { ok: true, messageId: sent?.id };
  } catch (err) {
    console.error(`[이메일 접수 확인 발송 예외] → ${data.to}`, err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/* ───────────────────────────── 비회원 구매 확인 ───────────────────────────── */

interface GuestShopItem {
  productName: string;
  downloadToken: string; // UUID
}

interface GuestShopConfirmation {
  kind: "shop";
  to: string;
  customerName: string;
  totalAmount: number;
  paymentMethod: string;
  items: GuestShopItem[];
  orderNumber: string;      // merchant_uid 또는 order.id
  paidAt: string;           // ISO
  baseUrl: string;          // e.g. https://www.untitled-studio.kr
}

interface GuestClassConfirmation {
  kind: "class";
  to: string;
  customerName: string;
  className: string;
  schedule: string;
  totalAmount: number;
  paymentMethod: string;
  orderNumber: string;
  paidAt: string;
  baseUrl: string;
}

type GuestPurchaseData = GuestShopConfirmation | GuestClassConfirmation;

/**
 * 비회원 구매자(또는 회원)에게 구매 확인 + 상품 전달 메일을 발송합니다.
 * - Shop: 각 상품에 대한 토큰 기반 다운로드 링크 (30일 유효)
 * - Class: 수강 안내 + 문의처
 */
export async function sendGuestPurchaseConfirmation(
  data: GuestPurchaseData
): Promise<EmailResult> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn(
        "[이메일] RESEND_API_KEY가 설정되지 않아 비회원 구매 확인 메일 발송을 건너뜁니다."
      );
      return { ok: false, error: "RESEND_API_KEY missing" };
    }

    const paymentLabel =
      data.paymentMethod === "portone"
        ? "신용카드 (KG이니시스)"
        : data.paymentMethod === "bank_transfer"
          ? "계좌이체"
          : data.paymentMethod;

    const paidDate = new Date(data.paidAt);
    const paidLabel = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, "0")}-${String(paidDate.getDate()).padStart(2, "0")} ${String(paidDate.getHours()).padStart(2, "0")}:${String(paidDate.getMinutes()).padStart(2, "0")}`;

    let bodyHtml = "";
    let subject = "";

    if (data.kind === "shop") {
      subject = `[untitled-studio] 구매 확인 및 다운로드 안내 (주문번호: ${data.orderNumber})`;

      const itemsHtml = data.items
        .map((it) => {
          const url = `${data.baseUrl}/api/guest-download?token=${encodeURIComponent(it.downloadToken)}`;
          return `
            <div style="border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:12px;background:#0f0f0f;">
              <p style="margin:0 0 8px;color:#fff;font-weight:600;">${it.productName}</p>
              <a href="${url}" style="display:inline-block;background:#c8a2ff;color:#0a0a0a;padding:10px 18px;border-radius:8px;font-weight:600;text-decoration:none;">
                📥 다운로드 하기
              </a>
              <p style="margin:10px 0 0;color:#999;font-size:12px;">
                ※ 다운로드 링크는 결제일로부터 30일간 유효합니다.
              </p>
            </div>
          `;
        })
        .join("");

      bodyHtml = `
        <h2 style="margin:0 0 20px;color:#c8a2ff;">✅ 구매가 완료되었습니다!</h2>
        <p style="margin:0 0 16px;color:#fff;line-height:1.6;">
          ${data.customerName} 님, 구매해 주셔서 감사합니다.<br/>
          아래 버튼을 클릭하여 상품을 다운로드하실 수 있습니다.
        </p>

        <div style="margin:24px 0;">
          ${itemsHtml}
        </div>

        <div style="background:#0f0f0f;border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;color:#999;font-size:13px;">주문 번호</p>
          <p style="margin:0;color:#fff;font-family:monospace;">${data.orderNumber}</p>
        </div>

        <div style="background:#1f1a2e;border:1px solid #c8a2ff44;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px;color:#c8a2ff;font-weight:600;">💡 안내</p>
          <p style="margin:0;color:#ddd;font-size:13px;line-height:1.6;">
            추후 동일한 이메일(<strong>${data.to}</strong>)로 회원가입하시면,
            구매 내역이 마이페이지에 자동 통합되어 언제든 재다운로드가 가능합니다.
          </p>
        </div>
      `;
    } else {
      // kind === "class"
      subject = `[untitled-studio] 수강신청 확인 - ${data.className} (주문번호: ${data.orderNumber})`;

      bodyHtml = `
        <h2 style="margin:0 0 20px;color:#c8a2ff;">🎬 수강신청이 완료되었습니다!</h2>
        <p style="margin:0 0 16px;color:#fff;line-height:1.6;">
          ${data.customerName} 님, 수강신청해 주셔서 감사합니다.<br/>
          아래 일정으로 클래스에 참여해 주세요.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <tr>
            <td style="padding:12px;border:1px solid #333;color:#999;width:100px;">클래스</td>
            <td style="padding:12px;border:1px solid #333;color:#fff;font-weight:600;">${data.className}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #333;color:#999;">일정</td>
            <td style="padding:12px;border:1px solid #333;color:#fff;font-weight:600;">${data.schedule}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #333;color:#999;">수강생</td>
            <td style="padding:12px;border:1px solid #333;color:#fff;">${data.customerName}</td>
          </tr>
        </table>

        <div style="background:#1f1a2e;border:1px solid #c8a2ff44;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px;color:#c8a2ff;font-weight:600;">📌 수강 전 안내</p>
          <p style="margin:0;color:#ddd;font-size:13px;line-height:1.7;">
            · 수강 3~5일 전, 입력하신 연락처로 장소 및 단톡방 링크를 안내드립니다.<br/>
            · 노트북(Premiere Pro 설치)과 휴대폰을 지참해 주세요.<br/>
            · 환불은 수강일 5일 전까지 가능합니다. (5~6일 전 50%, 7일 이상 전 100%)
          </p>
        </div>

        <div style="background:#0f0f0f;border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;color:#999;font-size:13px;">주문 번호</p>
          <p style="margin:0;color:#fff;font-family:monospace;">${data.orderNumber}</p>
        </div>

        <div style="background:#1f1a2e;border:1px solid #c8a2ff44;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px;color:#c8a2ff;font-weight:600;">💡 안내</p>
          <p style="margin:0;color:#ddd;font-size:13px;line-height:1.6;">
            추후 동일한 이메일(<strong>${data.to}</strong>)로 회원가입하시면,
            수강신청 내역이 마이페이지에 자동 통합됩니다.
          </p>
        </div>
      `;
    }

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;color:#fff;">
        ${bodyHtml}

        <div style="border-top:1px solid #333;margin-top:24px;padding-top:16px;">
          <p style="margin:0 0 8px;color:#999;font-size:12px;">
            결제일: ${paidLabel}<br/>
            결제 수단: ${paymentLabel}<br/>
            결제 금액: <span style="color:#c8a2ff;font-weight:600;">₩${data.totalAmount.toLocaleString("ko-KR")}</span>
          </p>
          <p style="margin:12px 0 0;color:#666;font-size:11px;">
            문의: untitled.mooje@gmail.com<br/>
            이 메일은 자동 발송된 알림입니다.
          </p>
        </div>
      </div>
    `;

    const { data: sent, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject,
      html,
    });

    if (sendError) {
      // Resend가 반환한 실제 에러(도메인 미인증, 수신자 형식 오류, 403 등) 상세 로깅
      console.error(
        `[이메일] 구매 확인 메일 발송 실패 → ${data.to}`,
        JSON.stringify(sendError, null, 2)
      );
      return { ok: false, error: sendError.message || "Resend error" };
    }

    console.log(
      `[이메일] 구매 확인 메일 발송 완료 → ${data.to} (id=${sent?.id ?? "unknown"})`
    );
    return { ok: true, messageId: sent?.id };
  } catch (err) {
    console.error(
      `[이메일 구매 확인 발송 예외] → ${data.to}`,
      err
    );
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

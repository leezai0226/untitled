import { Resend } from "resend";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "untitled.mooje@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
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
export async function sendPaymentNotification(data: PaymentNotification) {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn("[이메일] RESEND_API_KEY가 설정되지 않아 이메일 발송을 건너뜁니다.");
      return;
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

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[동그란문] ${isClass ? "클래스 수강신청" : "디지털 에셋 주문"} — ${data.customerName} / ₩${data.totalAmount.toLocaleString("ko-KR")}`,
      html,
    });

    console.log("[이메일] 관리자 결제 알림 발송 완료");
  } catch (err) {
    // 이메일 실패가 결제 플로우를 막지 않도록 에러만 로깅
    console.error("[이메일 발송 실패]", err);
  }
}

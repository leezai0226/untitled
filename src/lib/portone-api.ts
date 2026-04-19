/**
 * PortOne (Iamport) V1 API 헬퍼.
 * verify 라우트와 webhook 라우트에서 공용으로 사용합니다.
 */

const PORTONE_API_KEY = process.env.PORTONE_API_KEY ?? "";
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET ?? "";

export interface PortonePayment {
  imp_uid: string;
  merchant_uid: string;
  amount: number;
  status: string;
  custom_data?: string | null;
  pay_method?: string | null;
  buyer_email?: string | null;
  buyer_name?: string | null;
  buyer_tel?: string | null;
  paid_at?: number | null;
  [key: string]: unknown;
}

/** 액세스 토큰 발급 */
export async function getPortoneToken(): Promise<string> {
  if (!PORTONE_API_KEY || !PORTONE_API_SECRET) {
    throw new Error("PORTONE_API_KEY / PORTONE_API_SECRET가 설정되지 않았습니다.");
  }

  const res = await fetch("https://api.iamport.kr/users/getToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imp_key: PORTONE_API_KEY,
      imp_secret: PORTONE_API_SECRET,
    }),
  });

  const data = await res.json();
  if (data.code !== 0 || !data.response?.access_token) {
    console.error("[포트원 토큰 발급 실패]", data.message);
    throw new Error("결제 검증 서버 인증에 실패했습니다.");
  }

  return data.response.access_token as string;
}

/** imp_uid로 결제 정보 조회 */
export async function getPaymentInfo(impUid: string, token?: string): Promise<PortonePayment> {
  const accessToken = token ?? (await getPortoneToken());

  const res = await fetch(`https://api.iamport.kr/payments/${impUid}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (data.code !== 0 || !data.response) {
    throw new Error(data.message || "결제 정보 조회 실패");
  }

  return data.response as PortonePayment;
}

/** custom_data 문자열을 안전하게 JSON 파싱 */
export function parseCustomData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 무시
  }
  return {};
}

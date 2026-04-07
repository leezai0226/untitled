import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendPaymentNotification } from "@/utils/email";

/**
 * POST /api/notify
 * 계좌이체 등 프론트에서 직접 주문 생성 후 관리자 알림 이메일 발송
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    const body = await request.json();

    await sendPaymentNotification({
      orderType: body.orderType || "shop",
      customerName: body.customerName || "이름 없음",
      customerEmail: user.email || "",
      customerPhone: body.customerPhone || "",
      totalAmount: body.totalAmount || 0,
      paymentMethod: body.paymentMethod || "bank_transfer",
      items: body.items,
      className: body.className,
      schedule: body.schedule,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify] 오류:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

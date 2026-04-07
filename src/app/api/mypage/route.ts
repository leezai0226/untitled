import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * GET /api/mypage
 * Service Role로 order_items + orders를 조회하여
 * downloaded_at이 RLS에 의해 누락되지 않도록 보장합니다.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

    // 디지털 에셋 주문 (order_items + orders + products)
    const { data: shopData, error: shopError } = await adminClient
      .from("order_items")
      .select(`
        id,
        price,
        created_at,
        downloaded_at,
        product:products(id, title, category, thumbnail_url, file_url),
        order:orders!inner(id, status, paid_at, created_at, order_type, payment_method, user_id)
      `)
      .eq("order.user_id", user.id)
      .eq("order.order_type", "shop")
      .in("order.status", ["completed", "refunded"])
      .order("created_at", { ascending: false });

    if (shopError) {
      console.error("[마이페이지 API] 디지털 에셋 조회 실패:", shopError.message);
    }

    // 클래스 주문
    const { data: classData, error: classError } = await adminClient
      .from("orders")
      .select("id, status, order_type, class_name, schedule, schedule_id, total_amount, payment_method, paid_at, created_at, name")
      .eq("user_id", user.id)
      .eq("order_type", "class")
      .in("status", ["completed", "pending", "refunded"])
      .order("created_at", { ascending: false });

    if (classError) {
      console.error("[마이페이지 API] 클래스 주문 조회 실패:", classError.message);
    }

    return NextResponse.json({
      shopItems: shopData ?? [],
      classOrders: classData ?? [],
    });
  } catch (err) {
    console.error("[마이페이지 API] 에러:", err);
    return NextResponse.json({ error: "서버 내부 오류" }, { status: 500 });
  }
}

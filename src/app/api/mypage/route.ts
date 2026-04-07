import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * GET /api/mypage
 * Service Role로 조회하여 downloaded_at이 RLS에 의해 누락되지 않도록 보장
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

    // 1단계: 해당 유저의 shop 주문 목록
    const { data: shopOrders, error: shopOrderError } = await adminClient
      .from("orders")
      .select("id, status, paid_at, created_at, order_type, payment_method")
      .eq("user_id", user.id)
      .eq("order_type", "shop")
      .in("status", ["completed", "refunded"])
      .order("created_at", { ascending: false });

    if (shopOrderError) {
      console.error("[마이페이지] 1단계 shop 주문 조회 실패:", shopOrderError.message);
      return NextResponse.json({
        shopItems: [],
        classOrders: [],
        debug: { step: 1, error: shopOrderError.message, userId: user.id },
      });
    }

    console.log("[마이페이지] 1단계 shop 주문:", shopOrders?.length, "건, userId:", user.id);

    let shopItems: Record<string, unknown>[] = [];

    if (shopOrders && shopOrders.length > 0) {
      const orderIds = shopOrders.map((o) => o.id);

      // 2단계: order_items 조회
      const { data: itemsData, error: itemsError } = await adminClient
        .from("order_items")
        .select(`
          id,
          order_id,
          price,
          created_at,
          downloaded_at,
          product_id
        `)
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });

      if (itemsError) {
        console.error("[마이페이지] 2단계 order_items 조회 실패:", itemsError.message);
        return NextResponse.json({
          shopItems: [],
          classOrders: [],
          debug: { step: 2, error: itemsError.message, orderIds },
        });
      }

      console.log("[마이페이지] 2단계 order_items:", itemsData?.length, "건");

      // 3단계: 상품 정보 조회 (별도 쿼리)
      const productIds = [...new Set((itemsData ?? []).map((i) => i.product_id as string))];

      let productMap = new Map<string, Record<string, unknown>>();

      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await adminClient
          .from("products")
          .select("id, title, category, thumbnail_url, file_url")
          .in("id", productIds);

        if (productsError) {
          console.error("[마이페이지] 3단계 products 조회 실패:", productsError.message);
        } else {
          productMap = new Map(
            (productsData ?? []).map((p) => [p.id as string, p])
          );
        }

        console.log("[마이페이지] 3단계 products:", productsData?.length, "건");
      }

      // 4단계: 매핑
      const orderMap = new Map(shopOrders.map((o) => [o.id, o]));

      shopItems = (itemsData ?? []).map((item) => ({
        id: item.id,
        order_id: item.order_id,
        price: item.price,
        created_at: item.created_at,
        downloaded_at: item.downloaded_at,
        product: productMap.get(item.product_id as string) ?? null,
        order: orderMap.get(item.order_id as string) ?? null,
      }));
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
      console.error("[마이페이지] 클래스 주문 조회 실패:", classError.message);
    }

    return NextResponse.json({
      shopItems,
      classOrders: classData ?? [],
    });
  } catch (err) {
    console.error("[마이페이지 API] 에러:", err);
    return NextResponse.json({ error: "서버 내부 오류" }, { status: 500 });
  }
}

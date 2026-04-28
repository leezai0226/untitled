import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";
import { revalidatePath } from "next/cache";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

/* ── GET: 전체 링크 조회 (인증 불필요 - 메인페이지 공개 사용) ── */
export async function GET(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "1";

  const adminClient = getAdminClient();

  let query = adminClient
    .from("main_links")
    .select("*")
    .order("sort_order", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ links: data ?? [] });
}

/* ── POST: 링크 추가 (type, metadata 필드 포함) ── */
export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { title, url, is_active, sort_order, type, metadata } =
    await request.json();

  // spacer 타입은 title/url 필수 아님
  const isSpacer = type === "spacer";
  const isText = type === "text";

  if (!isSpacer && !isText && (!title?.trim() || !url?.trim())) {
    return NextResponse.json(
      { error: "제목과 URL은 필수입니다." },
      { status: 400 }
    );
  }
  if (isText && !metadata?.content?.trim()) {
    return NextResponse.json(
      { error: "텍스트 내용은 필수입니다." },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // sort_order 미지정 시 현재 최댓값 + 1
  let order = sort_order;
  if (order === undefined || order === null) {
    const { data: last } = await adminClient
      .from("main_links")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    order = (last?.sort_order ?? 0) + 1;
  }

  // 콘텐츠 타입별 저장 데이터 구성
  const insertData: Record<string, unknown> = {
    is_active: is_active ?? true,
    sort_order: order,
    type: type ?? "link",
    metadata: metadata ?? {},
  };

  if (isSpacer) {
    // spacer: 제목/URL을 더미값으로 채움
    insertData.title = "spacer";
    insertData.url = "";
  } else if (isText) {
    // text: title은 내용 앞 20자로 자동 설정
    const content = metadata?.content ?? "";
    insertData.title = title?.trim() || content.slice(0, 20);
    insertData.url = "";
  } else {
    // link: 일반 제목 + URL
    insertData.title = title.trim();
    insertData.url = url.trim();
  }

  const { data, error } = await adminClient
    .from("main_links")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ link: data });
}

/* ── PUT: 링크 수정 (단건 수정 & 순서 일괄 변경 모두 처리) ── */
export async function PUT(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const adminClient = getAdminClient();

  // 순서 일괄 업데이트: { orders: [{id, sort_order}, ...] }
  if (Array.isArray(body.orders)) {
    const updates = body.orders as { id: string; sort_order: number }[];
    for (const { id, sort_order } of updates) {
      await adminClient
        .from("main_links")
        .update({ sort_order })
        .eq("id", id);
    }
    revalidatePath("/");
    return NextResponse.json({ success: true });
  }

  // 단건 수정: { id, title?, url?, is_active?, sort_order?, type?, metadata? }
  const { id, ...fields } = body as {
    id: string;
    title?: string;
    url?: string;
    is_active?: boolean;
    sort_order?: number;
    type?: string;
    metadata?: Record<string, unknown>;
  };

  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (fields.title !== undefined) updateData.title = fields.title.trim();
  if (fields.url !== undefined) updateData.url = fields.url.trim();
  if (fields.is_active !== undefined) updateData.is_active = fields.is_active;
  if (fields.sort_order !== undefined) updateData.sort_order = fields.sort_order;
  if (fields.type !== undefined) updateData.type = fields.type;
  if (fields.metadata !== undefined) updateData.metadata = fields.metadata;

  const { error } = await adminClient
    .from("main_links")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}

/* ── DELETE: 링크 삭제 ── */
export async function DELETE(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const adminClient = getAdminClient();

  const { error } = await adminClient
    .from("main_links")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}

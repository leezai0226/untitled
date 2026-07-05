import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";

/**
 * 관리자 온라인 강좌 CRUD
 * resource: "course" | "chapter" | "lesson"
 */

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 120 });

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

const TABLE_MAP: Record<string, string> = {
  course: "courses",
  chapter: "course_chapters",
  lesson: "course_lessons",
};

/* ── GET: 전체 강좌 + 챕터 + 강의 트리 조회 ── */
export async function GET(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from("courses")
    .select(
      "*, course_chapters(*, course_lessons(*))"
    )
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 챕터/강의도 sort_order 순 정렬
  const courses = (data ?? []).map((c) => ({
    ...c,
    course_chapters: ((c.course_chapters as Record<string, unknown>[]) ?? [])
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map((ch) => ({
        ...ch,
        course_lessons: ((ch.course_lessons as Record<string, unknown>[]) ?? [])
          .sort((a, b) => (a.sort_order as number) - (b.sort_order as number)),
      })),
  }));

  return NextResponse.json({ courses });
}

/* ── POST: 생성 ── */
export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const resource = body.resource as string;
  const table = TABLE_MAP[resource];
  if (!table) {
    return NextResponse.json({ error: "잘못된 resource" }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const insertData: Record<string, unknown> = {};

  if (resource === "course") {
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "강좌 제목은 필수입니다." }, { status: 400 });
    }
    insertData.title = body.title.trim();
    insertData.description = body.description?.trim() || null;
    insertData.thumbnail_url = body.thumbnail_url?.trim() || null;
    insertData.price = Number(body.price) || 0;
    insertData.is_active = body.is_active ?? false;
  } else if (resource === "chapter") {
    if (!body.course_id || !body.title?.trim()) {
      return NextResponse.json({ error: "course_id와 제목이 필요합니다." }, { status: 400 });
    }
    insertData.course_id = body.course_id;
    insertData.title = body.title.trim();
  } else {
    if (!body.chapter_id || !body.title?.trim()) {
      return NextResponse.json({ error: "chapter_id와 제목이 필요합니다." }, { status: 400 });
    }
    insertData.chapter_id = body.chapter_id;
    insertData.title = body.title.trim();
    insertData.vimeo_url = body.vimeo_url?.trim() || "";
    insertData.duration_seconds = Number(body.duration_seconds) || 0;
    insertData.is_preview = body.is_preview ?? false;
  }

  // sort_order: 현재 최댓값 + 1
  let orderQuery = adminClient.from(table).select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (resource === "chapter") orderQuery = orderQuery.eq("course_id", body.course_id);
  if (resource === "lesson") orderQuery = orderQuery.eq("chapter_id", body.chapter_id);
  const { data: last } = await orderQuery.maybeSingle();
  insertData.sort_order = ((last?.sort_order as number) ?? 0) + 1;

  const { data, error } = await adminClient
    .from(table)
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

/* ── PUT: 수정 (단건 or 순서 일괄) ── */
export async function PUT(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const resource = body.resource as string;
  const table = TABLE_MAP[resource];
  if (!table) {
    return NextResponse.json({ error: "잘못된 resource" }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // 순서 일괄 변경: { orders: [{id, sort_order}] }
  if (Array.isArray(body.orders)) {
    for (const { id, sort_order } of body.orders as { id: string; sort_order: number }[]) {
      await adminClient.from(table).update({ sort_order }).eq("id", id);
    }
    return NextResponse.json({ success: true });
  }

  const { id } = body as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  const allow: Record<string, string[]> = {
    course: ["title", "description", "thumbnail_url", "price", "is_active", "sort_order"],
    chapter: ["title", "sort_order"],
    lesson: ["title", "vimeo_url", "duration_seconds", "is_preview", "sort_order"],
  };
  for (const field of allow[resource]) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  const { error } = await adminClient.from(table).update(updateData).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* ── DELETE: 삭제 (cascade로 하위 항목 자동 삭제) ── */
export async function DELETE(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { resource, id } = await request.json();
  const table = TABLE_MAP[resource as string];
  if (!table || !id) {
    return NextResponse.json({ error: "resource와 id가 필요합니다." }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const { error } = await adminClient.from(table).delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

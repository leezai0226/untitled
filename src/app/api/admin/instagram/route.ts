import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";
import { sanitize } from "@/utils/sanitize";

/** 관리자 — 인스타 자동 DM 설정 (계정 상태 / 규칙 CRUD / 발송 로그) */

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });

function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* ── GET: 계정 + 규칙 + 최근 로그 ── */
export async function GET(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = getAdminClient();

  const [{ data: accounts }, { data: rules }, { data: logs }] =
    await Promise.all([
      adminClient
        .from("instagram_accounts")
        .select("id, ig_user_id, username, token_expires_at, is_active, connected_at")
        .order("connected_at", { ascending: false }),
      adminClient
        .from("instagram_dm_rules")
        .select("*")
        .order("created_at", { ascending: false }),
      adminClient
        .from("instagram_dm_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return NextResponse.json({
    accounts: accounts ?? [],
    rules: rules ?? [],
    logs: logs ?? [],
    envReady: !!(
      process.env.INSTAGRAM_APP_ID &&
      process.env.INSTAGRAM_APP_SECRET &&
      process.env.INSTAGRAM_VERIFY_TOKEN
    ),
  });
}

/* ── POST: 규칙 생성 ── */
export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const adminClient = getAdminClient();

  const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
    .map((k: string) => sanitize(k).trim())
    .filter(Boolean);

  if (!body.account_id || !body.name?.trim() || keywords.length === 0) {
    return NextResponse.json(
      { error: "계정, 규칙 이름, 키워드는 필수입니다." },
      { status: 400 }
    );
  }
  const hasButton = !!(body.button_label?.trim() && body.button_url?.trim());
  if (!hasButton && !body.dm_text?.trim()) {
    return NextResponse.json(
      { error: "DM 내용 또는 버튼 설정이 필요합니다." },
      { status: 400 }
    );
  }
  if (hasButton && !body.card_title?.trim()) {
    return NextResponse.json(
      { error: "버튼 DM은 카드 제목이 필요합니다." },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient
    .from("instagram_dm_rules")
    .insert({
      account_id: body.account_id,
      name: sanitize(body.name),
      media_id: sanitize(body.media_id || "") || null,
      media_thumbnail_url: body.media_thumbnail_url || null,
      media_caption: sanitize(body.media_caption || "") || null,
      keywords,
      dm_text: sanitize(body.dm_text || ""),
      card_title: sanitize(body.card_title || "") || null,
      card_subtitle: sanitize(body.card_subtitle || "") || null,
      button_label: hasButton ? sanitize(body.button_label) : null,
      button_url: hasButton ? body.button_url.trim() : null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rule: data });
}

/* ── PUT: 규칙 수정 ── */
export async function PUT(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = sanitize(body.name);
  if (body.media_id !== undefined)
    updateData.media_id = sanitize(body.media_id || "") || null;
  if (body.media_thumbnail_url !== undefined)
    updateData.media_thumbnail_url = body.media_thumbnail_url || null;
  if (body.media_caption !== undefined)
    updateData.media_caption = sanitize(body.media_caption || "") || null;
  if (body.keywords !== undefined)
    updateData.keywords = (body.keywords as string[])
      .map((k) => sanitize(k).trim())
      .filter(Boolean);
  if (body.dm_text !== undefined) updateData.dm_text = sanitize(body.dm_text);
  if (body.card_title !== undefined)
    updateData.card_title = sanitize(body.card_title || "") || null;
  if (body.card_subtitle !== undefined)
    updateData.card_subtitle = sanitize(body.card_subtitle || "") || null;
  if (body.button_label !== undefined)
    updateData.button_label = sanitize(body.button_label || "") || null;
  if (body.button_url !== undefined)
    updateData.button_url = (body.button_url || "").trim() || null;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  const adminClient = getAdminClient();
  const { error } = await adminClient
    .from("instagram_dm_rules")
    .update(updateData)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/* ── DELETE: 규칙 삭제 또는 계정 연결 해제 ── */
export async function DELETE(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { resource, id } = await request.json();
  if (!id || !["rule", "account"].includes(resource)) {
    return NextResponse.json(
      { error: "resource(rule|account)와 id가 필요합니다." },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();
  const table =
    resource === "rule" ? "instagram_dm_rules" : "instagram_accounts";
  const { error } = await adminClient.from(table).delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

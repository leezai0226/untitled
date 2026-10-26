import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { createRateLimiter } from "@/utils/rateLimit";
import { fetchRecentMedia } from "@/lib/instagram";

/** GET /api/admin/instagram/media — 연결 계정의 최근 게시물 목록 (게시물 선택 UI) */

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

export async function GET(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // account_id 지정 시 해당 계정, 없으면 첫 활성 계정
  const accountId = new URL(request.url).searchParams.get("account_id");
  let query = adminClient
    .from("instagram_accounts")
    .select("access_token")
    .eq("is_active", true);
  if (accountId) query = query.eq("id", accountId);
  const { data: account } = await query.limit(1).maybeSingle();

  if (!account) {
    return NextResponse.json(
      { error: "연결된 인스타그램 계정이 없습니다." },
      { status: 400 }
    );
  }

  try {
    const media = await fetchRecentMedia(account.access_token, 30);
    return NextResponse.json({
      media: media.map((m) => ({
        id: m.id,
        caption: (m.caption ?? "").slice(0, 60),
        media_type: m.media_type,
        thumbnail: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
        permalink: m.permalink,
        timestamp: m.timestamp,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "게시물 조회 실패" },
      { status: 500 }
    );
  }
}

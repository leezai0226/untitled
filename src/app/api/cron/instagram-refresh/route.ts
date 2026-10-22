import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { refreshLongLivedToken } from "@/lib/instagram";

/**
 * GET /api/cron/instagram-refresh (pg_cron — 매일)
 * 만료 10일 이내인 인스타 장기 토큰을 갱신한다 (갱신 시 다시 60일).
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const threshold = new Date(Date.now() + 10 * 86400_000).toISOString();
  const { data: accounts } = await adminClient
    .from("instagram_accounts")
    .select("id, username, access_token, token_expires_at")
    .eq("is_active", true)
    .lte("token_expires_at", threshold);

  let refreshed = 0;
  const errors: string[] = [];

  for (const acc of accounts ?? []) {
    try {
      const result = await refreshLongLivedToken(acc.access_token);
      await adminClient
        .from("instagram_accounts")
        .update({
          access_token: result.access_token,
          token_expires_at: new Date(
            Date.now() + (result.expires_in ?? 60 * 86400) * 1000
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", acc.id);
      refreshed++;
    } catch (err) {
      errors.push(
        `${acc.username}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  if (errors.length) console.error("[instagram-refresh] 실패:", errors);
  return NextResponse.json({ refreshed, errors });
}

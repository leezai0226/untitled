import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchProfile,
  subscribeWebhooks,
  getInstagramEnv,
} from "@/lib/instagram";

/**
 * GET /api/instagram/oauth/callback
 * 인스타 인가 후 돌아오는 지점 — 토큰 교환 → 프로필 저장 → 웹훅 구독
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin: reqOrigin } = new URL(request.url);
  const code = searchParams.get("code");
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || reqOrigin;
  const adminUrl = `${origin}/admin/instagram`;

  if (!code) {
    const reason = searchParams.get("error_description") || "인가 거부됨";
    return NextResponse.redirect(
      `${adminUrl}?error=${encodeURIComponent(reason)}`
    );
  }

  const { appId, appSecret } = getInstagramEnv();
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      `${adminUrl}?error=${encodeURIComponent("환경변수 미설정 (APP_ID/SECRET)")}`
    );
  }

  try {
    // 1) code → 단기 토큰 → 장기 토큰(60일)
    const redirectUri = `${origin}/api/instagram/oauth/callback`;
    const shortLived = await exchangeCodeForToken({
      appId,
      appSecret,
      redirectUri,
      code,
    });
    const longLived = await exchangeForLongLivedToken(
      appSecret,
      shortLived.access_token
    );

    // 2) 프로필 조회
    const profile = await fetchProfile(longLived.access_token);
    const igUserId = profile.user_id || shortLived.user_id;

    // 3) 저장 (재연결 시 갱신)
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const expiresAt = new Date(
      Date.now() + (longLived.expires_in ?? 60 * 86400) * 1000
    ).toISOString();

    const { error } = await adminClient.from("instagram_accounts").upsert(
      {
        ig_user_id: igUserId,
        username: profile.username,
        access_token: longLived.access_token,
        token_expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ig_user_id" }
    );
    if (error) throw new Error(`계정 저장 실패: ${error.message}`);

    // 4) 댓글 웹훅 구독
    await subscribeWebhooks(igUserId, longLived.access_token);

    return NextResponse.redirect(`${adminUrl}?connected=1`);
  } catch (err) {
    console.error("[instagram/oauth] 연결 실패:", err);
    const msg = err instanceof Error ? err.message : "연결 실패";
    return NextResponse.redirect(`${adminUrl}?error=${encodeURIComponent(msg)}`);
  }
}

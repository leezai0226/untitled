import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/utils/verifyAdmin";
import { buildAuthorizeUrl, getInstagramEnv } from "@/lib/instagram";

/** GET /api/instagram/oauth/start — 관리자만 인스타 연결 시작 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { appId } = getInstagramEnv();
  if (!appId) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin;
  const redirectUri = `${origin}/api/instagram/oauth/callback`;

  return NextResponse.redirect(buildAuthorizeUrl(appId, redirectUri));
}

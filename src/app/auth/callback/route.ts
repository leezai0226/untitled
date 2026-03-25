import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * OAuth 콜백 Route Handler
 * 소셜 로그인 성공 후 Supabase가 이 URL로 리디렉트합니다.
 * code를 세션으로 교환한 뒤 메인 페이지로 이동합니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 에러 시 로그인 페이지로 리디렉트
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

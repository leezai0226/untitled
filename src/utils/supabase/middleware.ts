import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase 세션 갱신용 미들웨어 헬퍼
 * - 매 요청마다 쿠키를 통해 세션을 새로고침하여 만료를 방지
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 갱신 (중요: getUser를 호출해야 세션이 새로고침됨)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인 필요 페이지 보호
  // NOTE: /checkout 은 비회원 바로구매(?from=guest_shop) / 비회원 클래스 결제도 지원하므로
  //       미들웨어에서 일괄 차단하지 않고, 페이지 내부에서 모드별로 처리합니다.
  //       회원 전용 모드(/checkout?from=cart)는 checkout 페이지가 직접 리다이렉트합니다.
  const protectedPaths = ["/mypage", "/cart"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 관리자 페이지 보호: 로그인 + 관리자 이메일 + 관리자 쿠키
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  if (isAdminPath) {
    const adminEmail = process.env.ADMIN_EMAIL || "untitled.mooje@gmail.com";
    const adminCookie = request.cookies.get("admin_authenticated")?.value;

    // 비로그인 또는 관리자 이메일이 아닌 경우 → 홈으로
    if (!user || user.email !== adminEmail) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }

    // 관리자 비밀번호 인증 쿠키가 없으면 layout에서 비밀번호 입력 화면 표시 (기존 로직)
    // 쿠키는 layout.tsx에서 체크하므로 여기서는 이메일만 검증
    void adminCookie; // 참조만
  }

  return supabaseResponse;
}

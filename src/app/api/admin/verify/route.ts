import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRateLimiter } from "@/utils/rateLimit";

// 관리자 로그인: 1분에 5회 실패 시 차단 (Brute Force 방지)
const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

export async function POST(request: NextRequest) {
  const blocked = rateLimiter(request);
  if (blocked) return blocked;

  const { password } = await request.json();
  const secret = process.env.ADMIN_SECRET_PASSWORD;

  if (!secret) {
    return NextResponse.json(
      { error: "서버에 관리자 비밀번호가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  if (password !== secret) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  // 인증 성공 → 쿠키에 세션 저장 (24시간 유효)
  const cookieStore = await cookies();
  cookieStore.set("admin_authenticated", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24시간
    path: "/",
  });

  return NextResponse.json({ success: true });
}

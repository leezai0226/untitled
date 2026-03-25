import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

interface VerifyResult {
  authorized: boolean;
  userId?: string;
  error?: string;
  status?: number;
}

/**
 * 관리자 권한을 이중으로 검증합니다.
 *
 * 1차: 관리자 비밀번호 인증 쿠키 확인 (admin_authenticated)
 * 2차: Supabase JWT에서 app_metadata.role === 'admin' 확인
 *
 * 두 조건을 모두 통과해야 authorized: true를 반환합니다.
 */
export async function verifyAdmin(): Promise<VerifyResult> {
  // 1차: 쿠키 기반 비밀번호 인증 확인
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_authenticated")?.value;

  if (adminCookie !== "true") {
    return {
      authorized: false,
      error: "관리자 비밀번호 인증이 필요합니다.",
      status: 401,
    };
  }

  // 2차: Supabase Auth — 로그인 + 관리자 역할 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      error: "로그인이 필요합니다.",
      status: 401,
    };
  }

  const role = user.app_metadata?.role;
  if (role !== "admin") {
    return {
      authorized: false,
      error: "관리자 권한이 없습니다.",
      status: 403,
    };
  }

  return {
    authorized: true,
    userId: user.id,
  };
}

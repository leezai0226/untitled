"use client";

import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import FadeInSection from "@/components/FadeInSection";

type OAuthProvider = "kakao" | "google";

export default function LoginPage() {
  const handleSocialLogin = async (provider: OAuthProvider) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      alert(`로그인 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-20">
      <FadeInSection>
        <div className="w-full max-w-sm">
          {/* 헤더 */}
          <div className="text-center">
            <Link href="/" className="font-display text-2xl font-bold tracking-tight">
              <span className="text-primary">UNTITLED</span>PROJECTS
            </Link>
            <p className="mt-4 text-base text-sub-text">
              소셜 계정으로 간편하게 로그인하세요
            </p>
          </div>

          {/* 소셜 로그인 버튼 */}
          <div className="mt-10 flex flex-col gap-4">
            {/* 카카오 */}
            <button
              onClick={() => handleSocialLogin("kakao")}
              className="flex w-full items-center justify-center gap-3 rounded-xl px-6 py-4 text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: "#FEE500", color: "#191919" }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2C5.029 2 1 5.164 1 9.054c0 2.468 1.617 4.637 4.07 5.896l-1.04 3.84c-.088.326.28.592.568.41L8.32 16.62c.55.074 1.11.112 1.68.112 4.971 0 9-3.164 9-7.054S14.971 2 10 2z"
                  fill="#191919"
                />
              </svg>
              카카오로 로그인
            </button>

            {/* 구글 */}
            <button
              onClick={() => handleSocialLogin("google")}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-6 py-4 text-base font-semibold text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Google로 로그인
            </button>
          </div>

          {/* 안내 문구 */}
          <p className="mt-8 text-center text-xs text-sub-text leading-relaxed">
            로그인 시{" "}
            <span className="underline cursor-pointer hover:text-primary">이용약관</span> 및{" "}
            <span className="underline cursor-pointer hover:text-primary">개인정보처리방침</span>에
            동의하게 됩니다.
          </p>

          {/* 돌아가기 */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-sub-text transition-colors hover:text-primary"
            >
              ← 메인으로 돌아가기
            </Link>
          </div>
        </div>
      </FadeInSection>
    </div>
  );
}

"use client";

import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import FadeInSection from "@/components/FadeInSection";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      alert(`로그인 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-20 pb-12">
      <FadeInSection>
        <div className="w-full max-w-sm">
          {/* 헤더 */}
          <div className="text-center">
            <Link
              href="/"
              className="font-display text-2xl font-bold tracking-tight"
            >
              <span className="text-primary">UNTITLED</span>PROJECTS
            </Link>
            <h1 className="mt-8 text-xl font-bold text-white">
              로그인 또는 회원가입
            </h1>
            <p className="mt-3 text-sm text-sub-text leading-relaxed">
              Google 계정으로 간편하게 시작하거나,
              <br />
              로그인 없이 비회원 구매도 가능합니다.
            </p>
          </div>

          {/* 구글 로그인 */}
          <div className="mt-10">
            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-6 py-4 text-base font-semibold text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Google로 로그인
            </button>
          </div>

          {/* 구분선 + 비회원 구매 안내 */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-sub-text">또는</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card/50 p-4 text-center">
            <p className="text-sm text-white">
              회원가입 없이 바로 구매하세요
            </p>
            <p className="mt-1 text-xs text-sub-text leading-relaxed">
              결제 시 입력한 이메일로 상품이 자동 발송됩니다.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/shop"
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-primary hover:text-primary"
              >
                🛒 Shop 둘러보기
              </Link>
              <Link
                href="/class"
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-primary hover:text-primary"
              >
                🎬 Class 둘러보기
              </Link>
            </div>
          </div>

          {/* 안내 문구 */}
          <p className="mt-8 text-center text-xs text-sub-text leading-relaxed">
            로그인 시{" "}
            <Link
              href="/terms"
              className="underline hover:text-primary transition-colors"
            >
              이용약관
            </Link>{" "}
            및{" "}
            <Link
              href="/privacy"
              className="underline hover:text-primary transition-colors"
            >
              개인정보처리방침
            </Link>
            에 동의하게 됩니다.
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

"use client";

import { useState, useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ── 페이지 로드 시 인증 상태 확인 ── */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/admin/check");
        const data = await res.json();
        setAuthenticated(data.authenticated);
      } catch {
        setAuthenticated(false);
      }
      setChecking(false);
    };
    checkAuth();
  }, []);

  /* ── 비밀번호 제출 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAuthenticated(true);
      } else {
        setError(data.error || "인증에 실패했습니다.");
        setPassword("");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 로딩 ── */
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  /* ── 잠금 화면 ── */
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-card p-8">
            {/* 아이콘 */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-3xl">🔒</span>
            </div>

            <h1 className="mt-6 text-center text-xl font-bold text-white">
              관리자 인증
            </h1>
            <p className="mt-2 text-center text-sm text-sub-text">
              마스터 비밀번호를 입력해 주세요.
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                autoFocus
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
              />

              {error && (
                <p className="mt-3 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={!password.trim() || submitting}
                className={`mt-4 w-full rounded-xl py-3 text-base font-semibold transition-all duration-200 ${
                  password.trim() && !submitting
                    ? "bg-primary text-background hover:brightness-110 cursor-pointer"
                    : "bg-border text-sub-text cursor-not-allowed"
                }`}
              >
                {submitting ? "확인 중..." : "확인"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ── 인증 완료 → 자식 페이지 렌더링 ── */
  return <>{children}</>;
}

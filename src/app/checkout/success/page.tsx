"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isGuest = searchParams.get("guest") === "1";
  const isPending = searchParams.get("pending") === "1";
  const email = searchParams.get("email") || "";

  // 회원은 3초 뒤 마이페이지로 이동
  useEffect(() => {
    if (isGuest) return;
    const timer = setTimeout(() => router.push("/mypage"), 3000);
    return () => clearTimeout(timer);
  }, [router, isGuest]);

  /* ── 비회원 + 입금 대기 ── */
  if (isGuest && isPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pt-24">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/15">
              <span className="text-3xl">⏳</span>
            </div>
            <h1 className="mt-5 text-2xl font-bold text-white">
              주문이 접수되었습니다
            </h1>
            <p className="mt-3 text-base leading-relaxed text-sub-text">
              입금이 확인되는 대로 아래 이메일로
              <br />
              다운로드 / 수강 안내 메일이 발송됩니다.
            </p>

            {email && (
              <div className="mt-6 rounded-xl bg-background/50 px-4 py-3">
                <p className="text-xs text-sub-text">안내 받을 이메일</p>
                <p className="mt-1 break-all font-display text-sm font-semibold text-primary">
                  {email}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-primary">
                💡 입금 계좌 안내
              </p>
              <p className="text-xs leading-relaxed text-sub-text">
                입금 정보는 결제 페이지 하단의 계좌 정보를 참고해 주세요.
                <br />
                <strong className="text-white">입금자명</strong>이 결제 시 입력한 이름과
                다를 경우, 확인이 지연될 수 있습니다.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/"
                className="rounded-xl bg-primary px-6 py-3 text-center text-sm font-semibold text-background transition-all duration-200 hover:brightness-110"
              >
                홈으로 이동
              </Link>
              <Link
                href="/shop"
                className="rounded-xl border border-border px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:border-primary hover:text-primary"
              >
                스토어 계속 둘러보기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── 비회원 + 즉시 결제 완료 (카드) ── */
  if (isGuest) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pt-24">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
              <span className="text-3xl">✅</span>
            </div>
            <h1 className="mt-5 text-2xl font-bold text-white">
              결제가 완료되었습니다!
            </h1>
            <p className="mt-3 text-base leading-relaxed text-sub-text">
              구매해 주셔서 감사합니다.
              <br />
              입력하신 이메일로 다운로드 링크 및 안내 메일이 발송되었습니다.
            </p>

            {email && (
              <div className="mt-6 rounded-xl bg-background/50 px-4 py-3">
                <p className="text-xs text-sub-text">발송 이메일</p>
                <p className="mt-1 break-all font-display text-sm font-semibold text-primary">
                  {email}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-primary">
                💡 메일이 오지 않나요?
              </p>
              <ul className="space-y-1 text-xs leading-relaxed text-sub-text">
                <li>· 스팸함 / 프로모션 탭을 확인해 주세요.</li>
                <li>· 다운로드 링크는 결제일로부터 30일간 유효합니다.</li>
                <li>
                  · 추후 동일 이메일로 회원가입 시 마이페이지에 자동 통합됩니다.
                </li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/"
                className="rounded-xl bg-primary px-6 py-3 text-center text-sm font-semibold text-background transition-all duration-200 hover:brightness-110"
              >
                홈으로 이동
              </Link>
              <Link
                href="/shop"
                className="rounded-xl border border-border px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:border-primary hover:text-primary"
              >
                스토어 계속 둘러보기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── 회원 ── */
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
          <span className="text-4xl">✅</span>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-white">
          결제가 완료되었습니다!
        </h1>
        <p className="mt-3 text-base text-sub-text">
          마이페이지에서 구매한 상품을 확인하실 수 있습니다.
        </p>
        <p className="mt-2 text-sm text-sub-text">
          잠시 후 마이페이지로 이동합니다...
        </p>
        <button
          onClick={() => router.push("/mypage")}
          className="mt-8 rounded-xl bg-primary px-8 py-3 text-base font-semibold text-background transition-all duration-200 hover:brightness-110"
        >
          마이페이지로 이동
        </button>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function FailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const errorCode = searchParams.get("code") ?? "UNKNOWN";
  const errorMessage =
    searchParams.get("message") ?? "결제 중 오류가 발생했습니다.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
          <span className="text-4xl">⚠️</span>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-white">
          결제에 실패했습니다
        </h1>

        <p className="mt-3 text-base text-sub-text">{errorMessage}</p>

        <p className="mt-2 text-xs text-sub-text/60">에러 코드: {errorCode}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.back()}
            className="rounded-xl bg-primary px-8 py-3 text-base font-semibold text-background transition-all duration-200 hover:brightness-110"
          >
            다시 시도하기
          </button>
          <button
            onClick={() => router.push("/shop")}
            className="rounded-xl border border-border px-8 py-3 text-base font-semibold text-white transition-all duration-200 hover:border-primary hover:text-primary"
          >
            스토어로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <FailContent />
    </Suspense>
  );
}

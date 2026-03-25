"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const confirmedRef = useRef(false);

  useEffect(() => {
    const confirmPayment = async () => {
      // 중복 호출 방지
      if (confirmedRef.current) return;
      confirmedRef.current = true;

      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount) {
        setErrorMessage("결제 정보가 올바르지 않습니다.");
        setStatus("error");
        return;
      }

      // sessionStorage에서 메타데이터 가져오기
      let metadata = {};
      try {
        const raw = sessionStorage.getItem("checkout_metadata");
        if (raw) {
          metadata = JSON.parse(raw);
          sessionStorage.removeItem("checkout_metadata");
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
            metadata,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          // 3초 후 마이페이지로 이동
          setTimeout(() => router.push("/mypage"), 3000);
        } else {
          // 금액 위변조 감지 시 fail 페이지로 강제 리다이렉트
          if (data.code === "AMOUNT_MISMATCH" && data.redirect) {
            router.replace(data.redirect);
            return;
          }
          setErrorMessage(data.error || "결제 승인에 실패했습니다.");
          setStatus("error");
        }
      } catch {
        setErrorMessage("서버 오류가 발생했습니다.");
        setStatus("error");
      }
    };

    confirmPayment();
  }, [searchParams, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-6 text-lg font-semibold text-white">
          결제를 확인하고 있습니다...
        </p>
        <p className="mt-2 text-sm text-sub-text">잠시만 기다려 주세요.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-white">
            결제 승인 실패
          </h1>
          <p className="mt-3 text-base text-sub-text">{errorMessage}</p>
          <button
            onClick={() => router.push("/checkout?from=cart")}
            className="mt-8 rounded-xl bg-primary px-8 py-3 text-base font-semibold text-background transition-all duration-200 hover:brightness-110"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    );
  }

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
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

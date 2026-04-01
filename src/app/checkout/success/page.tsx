"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CheckoutSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push("/mypage"), 3000);
    return () => clearTimeout(timer);
  }, [router]);

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

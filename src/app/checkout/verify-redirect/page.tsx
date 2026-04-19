"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 모바일 PortOne 결제 후 PG사가 redirect 시켜주는 페이지.
 *
 * URL 쿼리: imp_uid, merchant_uid, imp_success, error_code, error_msg
 *
 * 흐름:
 *  1) imp_success 가 false → /checkout/fail
 *  2) imp_success 가 true 인데 sessionStorage에 metadata 있음
 *      → /api/portone/verify 호출 (정상 경로)
 *  3) imp_success 가 true 인데 sessionStorage 없음(새 탭/세션 만료 등)
 *      → /api/portone/verify 가 PortOne custom_data로 폴백 처리
 *  4) verify가 실패해도 webhook이 별도로 들어와 주문은 DB에 기록됨
 */
function VerifyRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const impUid = params.get("imp_uid");
    const merchantUid = params.get("merchant_uid");
    const impSuccessRaw = params.get("imp_success");
    const impSuccess =
      impSuccessRaw === "true" || impSuccessRaw === "Y" || impSuccessRaw === "1";
    const errorCode = params.get("error_code") || "";
    const errorMsg = params.get("error_msg") || "";

    const goFail = (code: string, msg: string) => {
      router.replace(
        `/checkout/fail?code=${encodeURIComponent(code)}&message=${encodeURIComponent(msg)}`
      );
    };

    if (!impUid || !merchantUid) {
      goFail(errorCode || "INVALID_REDIRECT", errorMsg || "결제 정보를 확인할 수 없습니다.");
      return;
    }

    if (impSuccessRaw !== null && !impSuccess) {
      goFail(errorCode || "USER_CANCEL", errorMsg || "결제가 취소되었습니다.");
      return;
    }

    /* sessionStorage 에서 metadata 복원 (가능한 경우) */
    let metadata: Record<string, unknown> = {};
    let buyerEmail: string | null = null;
    try {
      const raw = sessionStorage.getItem("portone_pending_metadata");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.metadata && typeof parsed.metadata === "object") {
            metadata = parsed.metadata as Record<string, unknown>;
          }
          if (typeof parsed.buyerEmail === "string") {
            buyerEmail = parsed.buyerEmail;
          }
        }
        sessionStorage.removeItem("portone_pending_metadata");
      }
    } catch {
      // 무시
    }

    (async () => {
      try {
        const res = await fetch("/api/portone/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imp_uid: impUid,
            merchant_uid: merchantUid,
            metadata,
          }),
        });

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          goFail("VERIFY_FAILED", `서버 오류 (${res.status})`);
          return;
        }

        const data = await res.json();

        if (res.ok && data.success) {
          const sp = new URLSearchParams();
          if (data.guest) sp.set("guest", "1");
          if (buyerEmail) sp.set("email", buyerEmail);
          if (data.emailSent === false) sp.set("mail_failed", "1");
          router.replace(
            `/checkout/success${sp.toString() ? `?${sp.toString()}` : ""}`
          );
        } else {
          goFail(
            data.code || "VERIFY_FAILED",
            data.error || "결제 검증에 실패했습니다."
          );
        }
      } catch (err) {
        goFail(
          "SERVER_ERROR",
          err instanceof Error ? err.message : "서버 오류가 발생했습니다."
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background pt-20 text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-sub-text">결제 결과를 확인하고 있습니다…</p>
      </div>
    </div>
  );
}

export default function VerifyRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background pt-20 text-white">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <VerifyRedirectInner />
    </Suspense>
  );
}

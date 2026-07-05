"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import FadeInSection from "@/components/FadeInSection";
import { sanitize } from "@/utils/sanitize";
import type { User } from "@supabase/supabase-js";

/* ─────────────── 타입 ─────────────── */

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_active: boolean;
}

function CourseCheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const courseId = searchParams.get("course_id") ?? "";

  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer" | "">("");
  const [depositorName, setDepositorName] = useState("");
  const [cashReceiptNumber, setCashReceiptNumber] = useState("");

  /* ── 초기화 ── */
  useEffect(() => {
    const init = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        alert("온라인 강의는 로그인 후 구매하실 수 있습니다.");
        router.replace(`/login?redirect=/course/checkout?course_id=${courseId}`);
        return;
      }
      setUser(currentUser);
      setName(
        currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          ""
      );

      if (!courseId) {
        alert("강좌 정보가 없습니다.");
        router.replace("/course");
        return;
      }

      // 강좌 정보 조회 (RLS 공개 select)
      const { data: courseData, error } = await supabase
        .from("courses")
        .select("id, title, description, thumbnail_url, price, is_active")
        .eq("id", courseId)
        .single();

      if (error || !courseData || !courseData.is_active) {
        alert("판매 중인 강좌가 아닙니다.");
        router.replace("/course");
        return;
      }
      setCourse(courseData as CourseRow);

      // 이미 수강 중인지 확인
      const { data: enrollment } = await supabase
        .from("course_enrollments")
        .select("expires_at")
        .eq("user_id", currentUser.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (enrollment && new Date(enrollment.expires_at) > new Date()) {
        alert("이미 수강 중인 강좌입니다.");
        router.replace(`/course/${courseId}/watch`);
        return;
      }

      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFormValid =
    name.trim() !== "" &&
    (paymentMethod === "card" ||
      (paymentMethod === "bank_transfer" && depositorName.trim() !== ""));

  /* ── 카드 결제 (PortOne) ── */
  const handleCardPayment = () => {
    const IMP = window.IMP;
    if (!IMP) {
      alert("결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
      return;
    }
    const impUid = process.env.NEXT_PUBLIC_IMP_UID;
    if (!impUid || !course || !user) {
      alert("결제 설정 오류입니다. 관리자에게 문의해 주세요.");
      setSubmitting(false);
      return;
    }

    IMP.init(impUid);

    const merchantUid = `course_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const metadata: Record<string, unknown> = {
      orderType: "course",
      courseId: course.id,
      name: name.trim(),
      phone: "",
    };

    const customDataPayload = {
      ...metadata,
      userId: user.id,
      userEmail: user.email ?? null,
    };

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    IMP.request_pay(
      {
        pg: "html5_inicis",
        pay_method: "card",
        merchant_uid: merchantUid,
        name: course.title,
        amount: course.price,
        buyer_email: user.email ?? "",
        buyer_name: name.trim(),
        buyer_tel: "",
        m_redirect_url: `${origin}/checkout/verify-redirect`,
        custom_data: JSON.stringify(customDataPayload),
      },
      async (response) => {
        if (response.success && response.imp_uid && response.merchant_uid) {
          try {
            const verifyRes = await fetch("/api/portone/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imp_uid: response.imp_uid,
                merchant_uid: response.merchant_uid,
                metadata,
              }),
            });
            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              alert("결제가 완료되었습니다! 바로 수강하실 수 있습니다.");
              router.push(`/course/${course.id}/watch`);
            } else {
              alert(verifyData.error || "결제 검증에 실패했습니다.");
            }
          } catch {
            alert("서버 오류가 발생했습니다. 관리자에게 문의해 주세요.");
          }
        } else {
          alert(response.error_msg || "결제가 취소되었습니다.");
        }
        setSubmitting(false);
      }
    );
  };

  /* ── 계좌이체 주문 ── */
  const handleBankTransfer = async () => {
    if (!course || !user) return;
    try {
      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        order_type: "course",
        course_id: course.id,
        class_name: course.title,
        total_amount: course.price,
        name: sanitize(name),
        phone: "",
        payment_method: "bank_transfer",
        depositor_name: sanitize(depositorName),
        cash_receipt_number: sanitize(cashReceiptNumber) || null,
        status: "pending",
      });

      if (error) throw new Error(error.message);

      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "class",
          customerName: name.trim(),
          customerPhone: "",
          totalAmount: course.price,
          paymentMethod: "bank_transfer",
          className: `[온라인 강의] ${course.title}`,
          schedule: "수강기간 1년",
        }),
      }).catch(() => {});

      alert(
        "주문이 접수되었습니다!\n입금 확인 후 수강이 활성화됩니다."
      );
      router.push(`/course/${course.id}`);
    } catch (err) {
      alert(
        `주문 처리 중 오류가 발생했습니다: ${err instanceof Error ? err.message : "알 수 없는 오류"}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return;
    setSubmitting(true);
    if (paymentMethod === "card") {
      handleCardPayment();
    } else {
      await handleBankTransfer();
    }
  };

  if (loading || !course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-20">
        <p className="text-sub-text">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          강의 <span className="text-primary">결제</span>
        </h1>

        {/* ── 주문 상품 ── */}
        <FadeInSection>
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-background">
                {course.thumbnail_url ? (
                  <Image
                    src={course.thumbnail_url}
                    alt={course.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">
                    🎬
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{course.title}</p>
                <p className="text-xs text-sub-text mt-1">
                  온라인 강의 · 수강기간 1년
                </p>
                <p className="mt-1 font-display text-lg font-bold text-primary">
                  ₩{course.price.toLocaleString("ko-KR")}
                </p>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* ── 구매자 정보 ── */}
        <FadeInSection delay={0.1}>
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-white">구매자 정보</h2>
            <div className="mt-5">
              <label className="block text-sm font-medium text-sub-text mb-2">
                이름 <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="실명을 입력해 주세요"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>
        </FadeInSection>

        {/* ── 결제 수단 ── */}
        <FadeInSection delay={0.2}>
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-white">결제 수단</h2>
            <div className="mt-5 space-y-3">
              {/* 카드 */}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                  paymentMethod === "card"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "card"}
                  onChange={() => setPaymentMethod("card")}
                  className="sr-only"
                />
                <span className="text-xl">💳</span>
                <div>
                  <p className="text-sm font-semibold text-white">신용카드</p>
                  <p className="text-xs text-sub-text">
                    결제 즉시 수강 가능
                  </p>
                </div>
              </label>

              {/* 계좌이체 */}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                  paymentMethod === "bank_transfer"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "bank_transfer"}
                  onChange={() => setPaymentMethod("bank_transfer")}
                  className="sr-only"
                />
                <span className="text-xl">🏦</span>
                <div>
                  <p className="text-sm font-semibold text-white">계좌이체</p>
                  <p className="text-xs text-sub-text">
                    입금 확인 후 수강 활성화 (영업일 기준 1일 이내)
                  </p>
                </div>
              </label>
            </div>

            {/* 계좌이체 추가 입력 */}
            {paymentMethod === "bank_transfer" && (
              <div className="mt-5 rounded-xl border border-border bg-background p-5">
                <p className="text-sm text-sub-text leading-relaxed">
                  <span className="font-semibold text-white">카카오뱅크</span>{" "}
                  3333-28-7160406{" "}
                  <span className="text-sub-text">(예금주: 이영재)</span>
                </p>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-sub-text mb-2">
                    입금자명 <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={depositorName}
                    onChange={(e) => setDepositorName(e.target.value)}
                    placeholder="입금하실 분 성함"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-sub-text mb-2">
                    현금영수증 번호{" "}
                    <span className="text-xs text-sub-text/60">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={cashReceiptNumber}
                    onChange={(e) => setCashReceiptNumber(e.target.value)}
                    placeholder="핸드폰 번호 입력"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
        </FadeInSection>

        {/* ── 결제 버튼 ── */}
        <FadeInSection delay={0.3}>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || submitting}
            className="mt-8 w-full rounded-xl bg-primary px-6 py-4 text-base font-bold text-background transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? "처리 중..."
              : `₩${course.price.toLocaleString("ko-KR")} 결제하기`}
          </button>
        </FadeInSection>
      </div>
    </div>
  );
}

export default function CourseCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background pt-20">
          <p className="text-sub-text">불러오는 중...</p>
        </div>
      }
    >
      <CourseCheckoutForm />
    </Suspense>
  );
}

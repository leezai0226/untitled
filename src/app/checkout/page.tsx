"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import FadeInSection from "@/components/FadeInSection";
import { sanitize } from "@/utils/sanitize";
import type { User } from "@supabase/supabase-js";

/* ─────────────── 타입 ─────────────── */

interface FormData {
  name: string;
  phone: string;
  experienceLevel: string;
  message: string;
  paymentMethod: "kakaopay" | "bank_transfer" | "";
  depositorName: string;
  cashReceiptNumber: string;
}

interface CartProduct {
  id: string;
  product_id: string;
  product: {
    id: string;
    title: string;
    price: number;
    category: string;
    thumbnail_url: string | null;
  };
}

/* ─────────────── 내부 폼 컴포넌트 ─────────────── */

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // 주문 유형 결정
  const fromCart = searchParams.get("from") === "cart";
  const className = searchParams.get("class") ?? "";
  const schedule = searchParams.get("schedule") ?? "";
  const scheduleId = searchParams.get("schedule_id") ?? "";
  const classId = searchParams.get("class_id") ?? "";

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 장바구니 상품 (샵 결제용)
  const [cartItems, setCartItems] = useState<CartProduct[]>([]);
  const [classPrice, setClassPrice] = useState(299000);
  const totalAmount = fromCart
    ? cartItems.reduce((sum, item) => sum + (item.product?.price ?? 0), 0)
    : classPrice;

  const [form, setForm] = useState<FormData>({
    name: "",
    phone: "",
    experienceLevel: "",
    message: "",
    paymentMethod: "",
    depositorName: "",
    cashReceiptNumber: "",
  });

  /* ── 인증 확인 + 장바구니 로드 ── */
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUser(user);
      setForm((prev) => ({
        ...prev,
        name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      }));

      // 클래스 결제인 경우 DB에서 실제 가격 로드
      if (!fromCart && classId) {
        const { data: classRow } = await supabase
          .from("classes")
          .select("price")
          .eq("id", classId)
          .single();
        if (classRow) {
          setClassPrice(classRow.price);
        }
      }

      // 장바구니 결제인 경우 장바구니 데이터 로드
      if (fromCart) {
        const { data, error } = await supabase
          .from("cart_items")
          .select(
            "id, product_id, product:products(id, title, price, category, thumbnail_url)"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("장바구니 조회 실패:", error.message);
        } else {
          const normalized = (data ?? []).map(
            (item: Record<string, unknown>) => ({
              id: item.id as string,
              product_id: item.product_id as string,
              product: item.product as CartProduct["product"],
            })
          );
          setCartItems(normalized);

          if (normalized.length === 0) {
            alert("장바구니가 비어 있습니다.");
            router.replace("/cart");
            return;
          }
        }
      }

      setLoading(false);
    };
    init();
  }, []);

  /* ── 폼 유효성 ── */
  const isFormValid = fromCart
    ? form.name.trim() !== "" &&
      form.phone.trim() !== "" &&
      (form.paymentMethod === "kakaopay" ||
        (form.paymentMethod === "bank_transfer" &&
          form.depositorName.trim() !== ""))
    : form.name.trim() !== "" &&
      form.phone.trim() !== "" &&
      form.experienceLevel !== "" &&
      (form.paymentMethod === "kakaopay" ||
        (form.paymentMethod === "bank_transfer" &&
          form.depositorName.trim() !== ""));

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!isFormValid || !user) return;
    setSubmitting(true);

    try {
      if (form.paymentMethod === "kakaopay") {
        /* ── 카카오페이 결제 ── */
        const orderType = fromCart ? "shop" : "class";

        const orderName = fromCart
          ? cartItems.length === 1
            ? cartItems[0].product.title
            : `${cartItems[0].product.title} 외 ${cartItems.length - 1}건`
          : className || "원데이 클래스";

        const metadata: Record<string, unknown> = {
          name: form.name.trim(),
          phone: form.phone.trim(),
        };

        if (!fromCart) {
          metadata.className = className;
          metadata.schedule = schedule;
          metadata.experienceLevel = form.experienceLevel;
          metadata.message = form.message.trim() || null;
          if (scheduleId) metadata.scheduleId = scheduleId;
          if (classId) metadata.classId = classId;
        }

        const res = await fetch("/api/kakaopay/ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderType, orderName, metadata }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "카카오페이 결제 준비에 실패했습니다.");
        }

        // 모바일/PC 분기 리다이렉트
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const redirectUrl = isMobile
          ? data.redirect_mobile_url
          : data.redirect_pc_url;

        window.location.href = redirectUrl;
      } else if (form.paymentMethod === "bank_transfer") {
        /* ── 계좌 이체 (기존 로직 유지) ── */
        if (fromCart) {
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
              user_id: user.id,
              order_type: "shop",
              total_amount: totalAmount,
              name: sanitize(form.name),
              phone: sanitize(form.phone),
              payment_method: "bank_transfer",
              depositor_name: sanitize(form.depositorName),
              cash_receipt_number: sanitize(form.cashReceiptNumber) || null,
              status: "pending",
            })
            .select("id")
            .single();

          if (orderError || !order) {
            throw new Error(`주문 생성 실패: ${orderError?.message}`);
          }

          const orderItems = cartItems.map((item) => ({
            order_id: order.id,
            product_id: item.product.id,
            price: item.product.price,
          }));

          await supabase.from("order_items").insert(orderItems);
          await supabase.from("cart_items").delete().eq("user_id", user.id);

          alert(
            "주문이 완료되었습니다! 입금 확인 후 마이페이지에서 다운로드하실 수 있습니다."
          );
          router.push("/mypage");
        } else {
          const classOrderData: Record<string, unknown> = {
            user_id: user.id,
            order_type: "class",
            total_amount: classPrice,
            class_name: sanitize(className),
            schedule: sanitize(schedule),
            name: sanitize(form.name),
            phone: sanitize(form.phone),
            experience_level: sanitize(form.experienceLevel),
            message: sanitize(form.message) || null,
            payment_method: "bank_transfer",
            depositor_name: sanitize(form.depositorName),
            cash_receipt_number: sanitize(form.cashReceiptNumber) || null,
            status: "pending",
          };
          if (classId) classOrderData.class_id = classId;
          if (scheduleId) classOrderData.schedule_id = scheduleId;

          const { error } = await supabase.from("orders").insert(classOrderData);

          if (error) throw new Error(`오류가 발생했습니다: ${error.message}`);

          alert("수강신청이 완료되었습니다! 입금 확인 후 등록이 확정됩니다.");
          router.push("/");
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value as never }));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  /* ─────────────── UI ─────────────── */
  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* ── 주문 요약 ── */}
        <FadeInSection>
          <div className="rounded-xl border border-border bg-card p-7">
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              주문 <span className="text-primary">요약</span>
            </h1>

            {fromCart ? (
              <div className="mt-6 space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                      {item.product?.thumbnail_url ? (
                        <Image
                          src={item.product.thumbnail_url}
                          alt={item.product.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-background text-[10px] text-sub-text">
                          img
                        </div>
                      )}
                    </div>
                    <span className="flex-1 truncate text-sm text-white">
                      {item.product?.title}
                    </span>
                    <span className="font-display text-sm font-semibold text-primary whitespace-nowrap">
                      ₩{(item.product?.price ?? 0).toLocaleString("ko-KR")}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base text-sub-text">총 결제 금액</span>
                    <span className="font-display text-2xl font-bold text-primary">
                      ₩{totalAmount.toLocaleString("ko-KR")}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-base text-sub-text">클래스</span>
                  <span className="text-base font-semibold text-white">
                    {className || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base text-sub-text">일정</span>
                  <span className="text-base font-semibold text-white">
                    {schedule || "—"}
                  </span>
                </div>
                <div className="border-t border-border my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-base text-sub-text">결제 금액</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-sm text-sub-text line-through">
                      399,000원
                    </span>
                    <span className="font-display text-2xl font-bold text-primary">
                      299,000원
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FadeInSection>

        {/* ── 주문자 정보 ── */}
        <FadeInSection delay={0.1}>
          <div className="mt-8 rounded-xl border border-border bg-card p-7">
            <h2 className="text-xl font-bold text-white">주문자 정보</h2>

            <div className="mt-6">
              <label className="block text-sm font-medium text-sub-text mb-2">
                이메일 <span className="text-primary">*</span>
              </label>
              <input
                type="email"
                value={user?.email ?? ""}
                readOnly
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-sub-text cursor-not-allowed"
              />
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-sub-text mb-2">
                이름 <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="실명을 입력해 주세요"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-sub-text mb-2">
                휴대폰 번호 <span className="text-primary">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="010-0000-0000"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>
        </FadeInSection>

        {/* ── 사전 설문 (클래스 결제만) ── */}
        {!fromCart && (
          <FadeInSection delay={0.2}>
            <div className="mt-8 rounded-xl border border-border bg-card p-7">
              <h2 className="text-xl font-bold text-white">수강생 사전 설문</h2>

              <div className="mt-6">
                <label className="block text-sm font-medium text-sub-text mb-3">
                  영상 편집 경험 <span className="text-primary">*</span>
                </label>
                <div className="space-y-3">
                  {[
                    { value: "beginner", label: "완전 처음이에요." },
                    { value: "basic", label: "조금 배웠지만 잘 못 다뤄요." },
                    { value: "intermediate", label: "어느정도 할 줄 알아요." },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all duration-200 ${
                        form.experienceLevel === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="experience"
                        value={opt.value}
                        checked={form.experienceLevel === opt.value}
                        onChange={(e) =>
                          update("experienceLevel", e.target.value)
                        }
                        className="sr-only"
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          form.experienceLevel === opt.value
                            ? "border-primary"
                            : "border-sub-text/40"
                        }`}
                      >
                        {form.experienceLevel === opt.value && (
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        )}
                      </span>
                      <span className="text-base text-white">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-sub-text mb-2">
                  하고 싶은 말{" "}
                  <span className="text-sub-text/60">(선택)</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  rows={4}
                  placeholder="궁금한 점이나 전달하고 싶은 내용을 자유롭게 적어 주세요."
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>
          </FadeInSection>
        )}

        {/* ── 결제 수단 ── */}
        <FadeInSection delay={fromCart ? 0.2 : 0.3}>
          <div className="mt-8 rounded-xl border border-border bg-card p-7">
            <h2 className="text-xl font-bold text-white">결제 수단</h2>

            <div className="mt-6 space-y-3">
              {/* 카카오페이 */}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all duration-200 ${
                  form.paymentMethod === "kakaopay"
                    ? "border-[#FEE500] bg-[#FEE500]/10"
                    : "border-border hover:border-[#FEE500]/50"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value="kakaopay"
                  checked={form.paymentMethod === "kakaopay"}
                  onChange={() => update("paymentMethod", "kakaopay")}
                  className="sr-only"
                />
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    form.paymentMethod === "kakaopay"
                      ? "border-[#FEE500]"
                      : "border-sub-text/40"
                  }`}
                >
                  {form.paymentMethod === "kakaopay" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FEE500]" />
                  )}
                </span>
                <span className="text-base font-semibold text-white">
                  카카오페이
                </span>
              </label>

              {/* 계좌 이체 */}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all duration-200 ${
                  form.paymentMethod === "bank_transfer"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value="bank_transfer"
                  checked={form.paymentMethod === "bank_transfer"}
                  onChange={() => update("paymentMethod", "bank_transfer")}
                  className="sr-only"
                />
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    form.paymentMethod === "bank_transfer"
                      ? "border-primary"
                      : "border-sub-text/40"
                  }`}
                >
                  {form.paymentMethod === "bank_transfer" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </span>
                <span className="text-base text-white">계좌 이체</span>
              </label>
            </div>

            {/* 카카오페이 안내 */}
            {form.paymentMethod === "kakaopay" && (
              <div className="mt-5 rounded-xl border border-[#FEE500]/20 bg-[#FEE500]/5 p-4">
                <p className="text-sm text-sub-text leading-relaxed">
                  <span className="font-semibold text-[#FEE500]">결제하기</span> 버튼을 누르면 카카오페이 결제창으로 이동합니다.
                  <br />
                  카카오톡 앱에서 결제를 승인해 주세요.
                </p>
              </div>
            )}

            {/* 계좌 이체 상세 */}
            {form.paymentMethod === "bank_transfer" && (
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
                    value={form.depositorName}
                    onChange={(e) => update("depositorName", e.target.value)}
                    placeholder="입금자명을 입력해 주세요"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-sub-text mb-2">
                    현금영수증 번호{" "}
                    <span className="text-sub-text/60">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={form.cashReceiptNumber}
                    onChange={(e) =>
                      update("cashReceiptNumber", e.target.value)
                    }
                    placeholder="휴대폰 번호 또는 사업자번호"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
        </FadeInSection>

        {/* ── 결제 버튼 ── */}
        <FadeInSection delay={fromCart ? 0.3 : 0.4}>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || submitting}
            className={`mt-8 w-full rounded-xl py-4 text-lg font-semibold transition-all duration-200 ${
              isFormValid && !submitting
                ? form.paymentMethod === "kakaopay"
                  ? "bg-[#FEE500] text-[#3C1E1E] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#FEE500]/25 cursor-pointer"
                  : "bg-primary text-background hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
                : "bg-border text-sub-text cursor-not-allowed"
            }`}
          >
            {submitting
              ? "처리 중..."
              : form.paymentMethod === "kakaopay"
                ? `카카오페이로 ₩${totalAmount.toLocaleString("ko-KR")} 결제`
                : `₩${totalAmount.toLocaleString("ko-KR")} 결제하기`}
          </button>
        </FadeInSection>
      </div>
    </div>
  );
}

/* ─────────────── 페이지 (Suspense 래핑) ─────────────── */

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center pt-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}

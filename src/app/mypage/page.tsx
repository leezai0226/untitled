"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import FadeInSection from "@/components/FadeInSection";

/* ── 타입 ── */
interface OrderItem {
  id: string;
  price: number;
  created_at: string;
  downloaded_at: string | null;
  product: {
    id: string;
    title: string;
    category: string;
    thumbnail_url: string | null;
    file_url: string | null;
  };
  order: {
    id: string;
    status: string;
    paid_at: string | null;
    created_at: string;
    order_type: string;
    payment_method: string;
  };
}

const DOWNLOAD_DAYS = 30;

function getDaysRemaining(paidAt: string | null, orderCreatedAt: string): number {
  const baseDate = paidAt ? new Date(paidAt) : new Date(orderCreatedAt);
  const expiry = new Date(baseDate);
  expiry.setDate(expiry.getDate() + DOWNLOAD_DAYS);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getExpiryDate(paidAt: string | null, orderCreatedAt: string): string {
  const baseDate = paidAt ? new Date(paidAt) : new Date(orderCreatedAt);
  const expiry = new Date(baseDate);
  expiry.setDate(expiry.getDate() + DOWNLOAD_DAYS);
  return formatDate(expiry.toISOString());
}

export default function MyPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("order_items")
        .select(`
          id,
          price,
          created_at,
          downloaded_at,
          product:products(id, title, category, thumbnail_url, file_url),
          order:orders!inner(id, status, paid_at, created_at, order_type, payment_method)
        `)
        .eq("order.user_id", user.id)
        .in("order.status", ["completed", "refunded"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("구매 내역 조회 실패:", error.message);
      } else {
        const normalized = (data ?? []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          price: item.price as number,
          created_at: item.created_at as string,
          downloaded_at: (item.downloaded_at as string) || null,
          product: item.product as OrderItem["product"],
          order: item.order as OrderItem["order"],
        }));
        setItems(normalized);
      }
      setLoading(false);
    };
    fetchPurchases();
  }, []);

  /* ── 다운로드 (서버 API 경유 — 구매 검증 + Signed URL + 강제 다운로드) ── */
  const handleDownload = async (item: OrderItem) => {
    if (!item.product?.id) {
      alert("상품 정보가 올바르지 않습니다.");
      return;
    }

    // 다운로드 전 확인 (최초 다운로드 시)
    if (!item.downloaded_at) {
      const confirmed = window.confirm(
        "다운로드를 시작하면 해당 상품은 환불이 불가합니다.\n계속하시겠습니까?"
      );
      if (!confirmed) return;
    }

    setDownloading(item.id);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.product.id }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`서버 오류 (${res.status})`);
      }

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "다운로드에 실패했습니다.");
        setDownloading(null);
        return;
      }

      if (data.signedUrl) {
        // 강제 다운로드 (새 탭 대신 현재 창에서 다운로드)
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // 다운로드 기록 반영 (UI 즉시 업데이트)
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, downloaded_at: new Date().toISOString() }
              : i
          )
        );
      } else {
        alert("다운로드 링크를 생성하지 못했습니다.");
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }

    setDownloading(null);
  };

  /* ── 환불 요청 ── */
  const handleRefund = async (item: OrderItem) => {
    if (item.downloaded_at) {
      alert("다운로드한 상품은 환불이 불가합니다.");
      return;
    }

    const confirmed = window.confirm(
      `"${item.product.title}" 상품을 환불하시겠습니까?\n환불 후에는 다운로드가 불가합니다.`
    );
    if (!confirmed) return;

    setRefunding(item.id);

    try {
      const res = await fetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId: item.id }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`서버 오류 (${res.status})`);
      }

      const data = await res.json();

      if (res.ok && data.success) {
        alert(data.message);
        // UI 업데이트: 주문 상태를 refunded로 변경
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, order: { ...i.order, status: "refunded" } }
              : i
          )
        );
      } else {
        alert(data.error || "환불 처리에 실패했습니다.");
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }

    setRefunding(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <FadeInSection>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            마이페이지
          </h1>
          <p className="mt-2 text-base text-sub-text">
            결제 완료된 디지털 에셋을 다운로드하세요.
          </p>
        </FadeInSection>

        {items.length === 0 ? (
          <FadeInSection delay={0.1}>
            <div className="mt-16 text-center">
              <p className="text-lg text-sub-text">구매한 상품이 없습니다.</p>
              <a
                href="/shop"
                className="mt-4 inline-block text-primary hover:underline"
              >
                스토어 둘러보기 →
              </a>
            </div>
          </FadeInSection>
        ) : (
          <div className="mt-8 space-y-4">
            {items.map((item, i) => {
              const isRefunded = item.order.status === "refunded";
              const daysLeft = getDaysRemaining(item.order.paid_at, item.order.created_at);
              const expired = daysLeft <= 0;
              const expiryDate = getExpiryDate(item.order.paid_at, item.order.created_at);
              const purchaseDate = formatDate(item.order.paid_at || item.order.created_at);
              const isDownloaded = !!item.downloaded_at;
              const canRefund =
                !isRefunded &&
                !isDownloaded &&
                !expired &&
                item.order.order_type === "shop";

              return (
                <FadeInSection key={item.id} delay={i * 0.05}>
                  <div
                    className={`rounded-xl border bg-card p-5 ${
                      isRefunded
                        ? "border-red-500/30 opacity-60"
                        : "border-border"
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* 썸네일 */}
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                        {item.product?.thumbnail_url ? (
                          <Image
                            src={item.product.thumbnail_url}
                            alt={item.product.title}
                            fill
                            className="object-cover"
                            sizes="112px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-sub-text">
                            No img
                          </div>
                        )}
                      </div>

                      {/* 정보 */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-display font-semibold uppercase tracking-wider text-primary">
                          {item.product?.category}
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-white">
                          {item.product?.title}
                        </h3>
                        <p className="mt-1 text-xs text-sub-text">
                          결제일: {purchaseDate}
                        </p>

                        {/* 상태 표시 */}
                        {isRefunded ? (
                          <p className="mt-1 text-xs font-semibold text-red-400">
                            환불 완료
                          </p>
                        ) : isDownloaded ? (
                          <p className="mt-1 text-xs text-green-400">
                            다운로드 완료 ({formatDate(item.downloaded_at!)})
                          </p>
                        ) : expired ? (
                          <p className="mt-1 text-xs text-red-400">
                            다운로드 만료 ({expiryDate})
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-sub-text">
                            다운로드 기한: {expiryDate}{" "}
                            <span className="text-primary font-semibold">
                              (D-{daysLeft}일 남음)
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 버튼 영역 */}
                    {!isRefunded && (
                      <div className="mt-4 flex gap-3">
                        {/* 다운로드 버튼 */}
                        <div className="flex-1">
                          {expired ? (
                            <button
                              disabled
                              className="w-full rounded-xl bg-border py-3 text-sm font-semibold text-sub-text cursor-not-allowed"
                            >
                              다운로드 만료
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDownload(item)}
                              disabled={downloading === item.id}
                              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {downloading === item.id
                                ? "준비 중..."
                                : isDownloaded
                                  ? "다시 다운로드"
                                  : "다운로드"}
                            </button>
                          )}
                        </div>

                        {/* 환불 버튼 */}
                        {item.order.order_type === "shop" && (
                          <button
                            onClick={() => handleRefund(item)}
                            disabled={!canRefund || refunding === item.id}
                            className={`shrink-0 rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${
                              canRefund && refunding !== item.id
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer"
                                : "border-border text-sub-text/40 cursor-not-allowed"
                            }`}
                          >
                            {refunding === item.id
                              ? "처리 중..."
                              : isDownloaded
                                ? "환불 불가"
                                : expired
                                  ? "기한 만료"
                                  : "환불"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

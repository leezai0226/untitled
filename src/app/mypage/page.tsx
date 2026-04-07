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

interface ClassOrder {
  id: string;
  status: string;
  order_type: string;
  class_name: string | null;
  schedule: string | null;
  schedule_id: string | null;
  total_amount: number;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  name: string | null;
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

/* ── 한국 시간 기준 수강일까지 남은 일수 ── */
function getDaysUntilClass(scheduleDateStr: string): number {
  const nowKST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  nowKST.setHours(0, 0, 0, 0);

  const dateMatch = scheduleDateStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (!dateMatch) return -1;

  const month = parseInt(dateMatch[1], 10);
  const day = parseInt(dateMatch[2], 10);

  let classDate = new Date(nowKST.getFullYear(), month - 1, day);
  classDate.setHours(0, 0, 0, 0);

  if (classDate.getTime() < nowKST.getTime() - 86400000 * 30) {
    classDate = new Date(nowKST.getFullYear() + 1, month - 1, day);
    classDate.setHours(0, 0, 0, 0);
  }

  const diffMs = classDate.getTime() - nowKST.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/* ── 클래스 환불 정책 표시 ── */
function getClassRefundInfo(daysUntil: number): {
  canRefund: boolean;
  refundRate: number;
  label: string;
  color: string;
} {
  if (daysUntil >= 7) {
    return { canRefund: true, refundRate: 100, label: "100% 환불 가능", color: "text-green-400" };
  }
  if (daysUntil >= 5) {
    return { canRefund: true, refundRate: 50, label: "50% 부분 환불", color: "text-yellow-400" };
  }
  return { canRefund: false, refundRate: 0, label: "환불 불가 (수강일 4일 이내)", color: "text-red-400" };
}

export default function MyPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [classOrders, setClassOrders] = useState<ClassOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"shop" | "class">("shop");

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // 디지털 에셋 주문
      const { data: shopData, error: shopError } = await supabase
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
        .eq("order.order_type", "shop")
        .in("order.status", ["completed", "refunded"])
        .order("created_at", { ascending: false });

      if (shopError) {
        console.error("디지털 에셋 조회 실패:", shopError.message);
      } else {
        const normalized = (shopData ?? []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          price: item.price as number,
          created_at: item.created_at as string,
          downloaded_at: (item.downloaded_at as string) || null,
          product: item.product as OrderItem["product"],
          order: item.order as OrderItem["order"],
        }));
        setItems(normalized);
      }

      // 클래스 주문
      const { data: classData, error: classError } = await supabase
        .from("orders")
        .select("id, status, order_type, class_name, schedule, schedule_id, total_amount, payment_method, paid_at, created_at, name")
        .eq("user_id", user.id)
        .eq("order_type", "class")
        .in("status", ["completed", "pending", "refunded"])
        .order("created_at", { ascending: false });

      if (classError) {
        console.error("클래스 주문 조회 실패:", classError.message);
      } else {
        setClassOrders((classData as ClassOrder[]) ?? []);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  /* ── 로그아웃 ── */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  /* ── 다운로드 ── */
  const handleDownload = async (item: OrderItem) => {
    if (!item.product?.id) {
      alert("상품 정보가 올바르지 않습니다.");
      return;
    }

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
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

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

  /* ── 디지털 에셋 환불 ── */
  const handleShopRefund = async (item: OrderItem) => {
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

  /* ── 클래스 환불 ── */
  const handleClassRefund = async (order: ClassOrder) => {
    const daysUntil = getDaysUntilClass(order.schedule || "");
    const info = getClassRefundInfo(daysUntil);

    if (!info.canRefund) {
      alert(info.label);
      return;
    }

    const refundAmount = Math.floor(order.total_amount * (info.refundRate / 100));
    const confirmMsg =
      info.refundRate === 100
        ? `"${order.class_name}" 수강을 취소하고 전액(₩${refundAmount.toLocaleString("ko-KR")}) 환불하시겠습니까?`
        : `"${order.class_name}" 수강을 취소하시겠습니까?\n\n수강일 ${daysUntil}일 전이므로 50% 부분 환불(₩${refundAmount.toLocaleString("ko-KR")})이 적용됩니다.`;

    if (!window.confirm(confirmMsg)) return;

    setRefunding(order.id);

    try {
      const res = await fetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`서버 오류 (${res.status})`);
      }

      const data = await res.json();

      if (res.ok && data.success) {
        alert(data.message);
        setClassOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: "refunded" } : o
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
        {/* 헤더 + 로그아웃 */}
        <FadeInSection>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                마이페이지
              </h1>
              <p className="mt-2 text-base text-sub-text">
                구매한 디지털 에셋과 수강신청 내역을 확인하세요.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm text-sub-text transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              로그아웃
            </button>
          </div>
        </FadeInSection>

        {/* 탭 */}
        <FadeInSection delay={0.05}>
          <div className="mt-8 flex gap-2">
            <button
              onClick={() => setActiveTab("shop")}
              className={`flex-1 rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 ${
                activeTab === "shop"
                  ? "bg-primary text-background"
                  : "border border-border bg-card text-white hover:border-primary/50"
              }`}
            >
              🛒 디지털 에셋 ({items.length})
            </button>
            <button
              onClick={() => setActiveTab("class")}
              className={`flex-1 rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 ${
                activeTab === "class"
                  ? "bg-primary text-background"
                  : "border border-border bg-card text-white hover:border-primary/50"
              }`}
            >
              🎬 수강신청 ({classOrders.length})
            </button>
          </div>
        </FadeInSection>

        {/* ═══ 디지털 에셋 탭 ═══ */}
        {activeTab === "shop" && (
          <>
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
              <div className="mt-6 space-y-4">
                {items.map((item, i) => {
                  const isRefunded = item.order.status === "refunded";
                  const daysLeft = getDaysRemaining(item.order.paid_at, item.order.created_at);
                  const expired = daysLeft <= 0;
                  const expiryDate = getExpiryDate(item.order.paid_at, item.order.created_at);
                  const purchaseDate = formatDate(item.order.paid_at || item.order.created_at);
                  const isDownloaded = !!item.downloaded_at;
                  const canRefund = !isRefunded && !isDownloaded && !expired;

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

                        {!isRefunded && (
                          <div className="mt-4 flex gap-3">
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

                            <button
                              onClick={() => handleShopRefund(item)}
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
                          </div>
                        )}
                      </div>
                    </FadeInSection>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ 클래스 수강신청 탭 ═══ */}
        {activeTab === "class" && (
          <>
            {classOrders.length === 0 ? (
              <FadeInSection delay={0.1}>
                <div className="mt-16 text-center">
                  <p className="text-lg text-sub-text">수강신청 내역이 없습니다.</p>
                  <a
                    href="/class"
                    className="mt-4 inline-block text-primary hover:underline"
                  >
                    클래스 둘러보기 →
                  </a>
                </div>
              </FadeInSection>
            ) : (
              <div className="mt-6 space-y-4">
                {classOrders.map((order, i) => {
                  const isRefunded = order.status === "refunded";
                  const isPending = order.status === "pending";
                  const daysUntil = getDaysUntilClass(order.schedule || "");
                  const refundInfo = getClassRefundInfo(daysUntil);
                  const isPast = daysUntil < 0;
                  const purchaseDate = formatDate(order.paid_at || order.created_at);

                  return (
                    <FadeInSection key={order.id} delay={i * 0.05}>
                      <div
                        className={`rounded-xl border bg-card p-6 ${
                          isRefunded
                            ? "border-red-500/30 opacity-60"
                            : "border-border"
                        }`}
                      >
                        {/* 상단: 클래스명 + 상태 배지 */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-white">
                              {order.class_name || "원데이 클래스"}
                            </h3>
                            <p className="mt-1 text-sm text-primary font-medium">
                              {order.schedule || "-"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold ${
                              isRefunded
                                ? "bg-red-500/15 text-red-400"
                                : isPending
                                  ? "bg-yellow-500/15 text-yellow-400"
                                  : isPast
                                    ? "bg-sub-text/15 text-sub-text"
                                    : "bg-green-500/15 text-green-400"
                            }`}
                          >
                            {isRefunded
                              ? "환불 완료"
                              : isPending
                                ? "입금 대기"
                                : isPast
                                  ? "수강 완료"
                                  : "수강 예정"}
                          </span>
                        </div>

                        {/* 상세 정보 */}
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-sub-text">결제일</span>
                            <p className="mt-0.5 font-medium text-white">{purchaseDate}</p>
                          </div>
                          <div>
                            <span className="text-sub-text">결제 금액</span>
                            <p className="mt-0.5 font-display font-semibold text-primary">
                              ₩{order.total_amount.toLocaleString("ko-KR")}
                            </p>
                          </div>
                          <div>
                            <span className="text-sub-text">결제 수단</span>
                            <p className="mt-0.5 text-white">
                              {order.payment_method === "portone"
                                ? "신용카드"
                                : order.payment_method === "bank_transfer"
                                  ? "계좌이체"
                                  : order.payment_method}
                            </p>
                          </div>
                          <div>
                            <span className="text-sub-text">수강자</span>
                            <p className="mt-0.5 text-white">{order.name || "-"}</p>
                          </div>
                        </div>

                        {/* 환불 정보 + 버튼 */}
                        {!isRefunded && !isPast && order.status === "completed" && (
                          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                            <div className="text-sm">
                              {daysUntil >= 0 && (
                                <>
                                  <span className="text-sub-text">
                                    수강일까지 <span className="font-semibold text-white">{daysUntil}일</span> 남음
                                  </span>
                                  <span className={`ml-2 text-xs font-semibold ${refundInfo.color}`}>
                                    ({refundInfo.label})
                                  </span>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => handleClassRefund(order)}
                              disabled={!refundInfo.canRefund || refunding === order.id}
                              className={`shrink-0 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                                refundInfo.canRefund && refunding !== order.id
                                  ? "border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer"
                                  : "border-border text-sub-text/40 cursor-not-allowed"
                              }`}
                            >
                              {refunding === order.id
                                ? "처리 중..."
                                : refundInfo.canRefund
                                  ? refundInfo.refundRate === 100
                                    ? "환불하기"
                                    : "50% 환불"
                                  : "환불 불가"}
                            </button>
                          </div>
                        )}

                        {/* 입금 대기 안내 */}
                        {isPending && (
                          <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                            <p className="text-xs text-yellow-400">
                              입금 확인 후 수강이 확정됩니다. 문의: untitled.mooje@gmail.com
                            </p>
                          </div>
                        )}
                      </div>
                    </FadeInSection>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

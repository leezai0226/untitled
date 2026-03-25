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

  useEffect(() => {
    const fetchPurchases = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // order_items와 관련 product, order 정보를 조인 조회
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          id,
          price,
          created_at,
          product:products(id, title, category, thumbnail_url, file_url),
          order:orders!inner(id, status, paid_at, created_at, order_type)
        `)
        .eq("order.user_id", user.id)
        .eq("order.status", "completed")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("구매 내역 조회 실패:", error.message);
      } else {
        const normalized = (data ?? []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          price: item.price as number,
          created_at: item.created_at as string,
          product: item.product as OrderItem["product"],
          order: item.order as OrderItem["order"],
        }));
        setItems(normalized);
      }
      setLoading(false);
    };
    fetchPurchases();
  }, []);

  /* ── 다운로드 (서버 API 경유 — 구매 검증 + Signed URL) ── */
  const handleDownload = async (item: OrderItem) => {
    if (!item.product?.id) {
      alert("상품 정보가 올바르지 않습니다.");
      return;
    }

    setDownloading(item.id);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.product.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "다운로드에 실패했습니다.");
        setDownloading(null);
        return;
      }

      if (data.signedUrl) {
        window.open(data.signedUrl, "_blank");
      } else {
        alert("다운로드 링크를 생성하지 못했습니다.");
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }

    setDownloading(null);
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
              const daysLeft = getDaysRemaining(item.order.paid_at, item.order.created_at);
              const expired = daysLeft <= 0;
              const expiryDate = getExpiryDate(item.order.paid_at, item.order.created_at);
              const purchaseDate = formatDate(item.order.paid_at || item.order.created_at);

              return (
                <FadeInSection key={item.id} delay={i * 0.05}>
                  <div className="rounded-xl border border-border bg-card p-5">
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

                        {/* 만료 정보 */}
                        {expired ? (
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

                    {/* 다운로드 버튼 */}
                    <div className="mt-4">
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
                          {downloading === item.id ? "준비 중..." : "다운로드"}
                        </button>
                      )}
                    </div>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import FadeInSection from "@/components/FadeInSection";

interface CartItem {
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

function formatPrice(n: number) {
  if (n === 0) return "무료";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function CartPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const fetchCart = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("cart_items")
        .select("id, product_id, product:products(id, title, price, category, thumbnail_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("장바구니 조회 실패:", error.message);
      } else {
        // Supabase returns joined data — normalize
        const normalized = (data ?? []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          product_id: item.product_id as string,
          product: item.product as CartItem["product"],
        }));
        setItems(normalized);
      }
      setLoading(false);
    };
    fetchCart();
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + (item.product?.price ?? 0), 0);

  const handleRemove = async (cartItemId: string) => {
    setDeleting(cartItemId);
    const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== cartItemId));
    }
    setDeleting(null);
  };

  const handleCheckout = () => {
    if (items.length === 0) return;
    router.push("/checkout?from=cart");
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
            장바구니
          </h1>
          <p className="mt-2 text-base text-sub-text">
            {items.length}개 상품
          </p>
        </FadeInSection>

        {items.length === 0 ? (
          <FadeInSection delay={0.1}>
            <div className="mt-16 text-center">
              <p className="text-lg text-sub-text">장바구니가 비어 있습니다.</p>
              <Link
                href="/shop"
                className="mt-4 inline-block text-primary hover:underline"
              >
                스토어 둘러보기 →
              </Link>
            </div>
          </FadeInSection>
        ) : (
          <>
            {/* 상품 목록 */}
            <div className="mt-8 space-y-4">
              {items.map((item, i) => (
                <FadeInSection key={item.id} delay={i * 0.05}>
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
                    {/* 썸네일 */}
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                      {item.product?.thumbnail_url ? (
                        <Image
                          src={item.product.thumbnail_url}
                          alt={item.product.title}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-sub-text">
                          No img
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-primary font-display font-semibold uppercase tracking-wider">
                        {item.product?.category}
                      </p>
                      <h3 className="mt-1 truncate text-base font-semibold text-white">
                        {item.product?.title}
                      </h3>
                      <p className="mt-1 font-display text-sm font-bold text-primary">
                        {formatPrice(item.product?.price ?? 0)}
                      </p>
                    </div>

                    {/* 삭제 */}
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={deleting === item.id}
                      className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-sub-text transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                    >
                      {deleting === item.id ? "..." : "삭제"}
                    </button>
                  </div>
                </FadeInSection>
              ))}
            </div>

            {/* 결제 요약 */}
            <FadeInSection delay={0.1}>
              <div className="mt-8 rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="text-base text-sub-text">총 결제 금액</span>
                  <span className="font-display text-2xl font-bold text-primary">
                    {formatPrice(totalAmount)}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  className="mt-6 w-full rounded-xl bg-primary py-4 text-lg font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25"
                >
                  전체 결제하기
                </button>
              </div>
            </FadeInSection>
          </>
        )}
      </div>
    </div>
  );
}

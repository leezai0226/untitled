"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import FadeInSection from "@/components/FadeInSection";
import MediaSlider, { SliderMediaItem } from "@/components/MediaSlider";
import { createClient } from "@/utils/supabase/client";

/* ── 타입 ── */
interface FaqItem {
  q: string;
  a: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  thumbnail_url: string | null;
  detail_images: string[];
  file_url: string | null;
  remaining_seats: number | null;
  faqs: FaqItem[] | null;
  refund_policy: FaqItem[] | null;
  slider_media: SliderMediaItem[] | null;
}

function formatPrice(n: number) {
  if (n === 0) return "무료 (Free)";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function ShopDetailClient({ productId }: { productId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [freeLoading, setFreeLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price, category, description, thumbnail_url, detail_images, file_url, remaining_seats, faqs, refund_policy, slider_media")
        .eq("id", productId)
        .single();

      if (error || !data) {
        router.replace("/shop");
        return;
      }
      setProduct(data as Product);
      setLoading(false);
    };
    fetchProduct();
  }, [productId]);

  if (loading || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const free = product.price === 0;
  const soldOut =
    product.remaining_seats !== null && product.remaining_seats <= 0;

  /* ── 장바구니 담기 ── */
  const handleAddCart = async () => {
    setCartLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      setCartLoading(false);
      return;
    }

    const { error } = await supabase.from("cart_items").upsert(
      { user_id: user.id, product_id: product.id },
      { onConflict: "user_id,product_id" }
    );

    setCartLoading(false);
    if (error) {
      alert(`장바구니 담기 실패: ${error.message}`);
    } else {
      if (window.confirm("장바구니에 담겼습니다! 장바구니로 이동하시겠습니까?")) {
        router.push("/cart");
      }
    }
  };

  /* ── 바로 구매 (유료) ──
   *   · 회원:  장바구니에 담고 /checkout?from=cart 로 이동
   *   · 비회원: /checkout?from=guest_shop&product_id=... 로 직행 (이메일 입력 폼 제공)
   */
  const handleBuyNow = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("cart_items").upsert(
        { user_id: user.id, product_id: product.id },
        { onConflict: "user_id,product_id" }
      );
      router.push("/checkout?from=cart");
      return;
    }

    // 비회원 바로 구매
    const params = new URLSearchParams({
      from: "guest_shop",
      product_id: product.id,
    });
    router.push(`/checkout?${params.toString()}`);
  };

  /* ── 무료 상품 즉시 받기 ── */
  const handleFreeDownload = async () => {
    setFreeLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      setFreeLoading(false);
      return;
    }

    // 이미 구매했는지 확인
    const { data: existingItems } = await supabase
      .from("order_items")
      .select("id, order_id!inner(user_id, status)")
      .eq("product_id", product.id);

    const alreadyOwned = existingItems?.some(
      (item: Record<string, unknown>) => {
        const order = item.order_id as Record<string, unknown>;
        return order.user_id === user.id && order.status === "completed";
      }
    );

    if (alreadyOwned) {
      alert("이미 보유한 상품입니다. 마이페이지에서 다운로드하세요.");
      router.push("/mypage");
      setFreeLoading(false);
      return;
    }

    // 무료 상품: Orders + Order_Items 즉시 생성 (status: completed)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_type: "shop",
        total_amount: 0,
        payment_method: "free",
        status: "completed",
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      alert(`오류가 발생했습니다: ${orderError?.message}`);
      setFreeLoading(false);
      return;
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: product.id,
        price: 0,
      });

    setFreeLoading(false);

    if (itemError) {
      alert(`오류가 발생했습니다: ${itemError.message}`);
    } else {
      alert("무료 상품이 등록되었습니다! 마이페이지에서 다운로드하세요.");
      router.push("/mypage");
    }
  };

  return (
    <div className="pt-20">
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <FadeInSection>
          {/* 뒤로가기 */}
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-sm text-sub-text transition-colors hover:text-primary"
          >
            ← 스토어로 돌아가기
          </Link>

          {/* 메인 레이아웃 */}
          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
            {/* 좌측 — 썸네일 */}
            <div className="aspect-video overflow-hidden rounded-xl border border-border bg-card">
              {product.thumbnail_url ? (
                <div className="relative h-full w-full">
                  <Image
                    src={product.thumbnail_url}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display text-base text-sub-text">
                    상품 이미지
                  </span>
                </div>
              )}
            </div>

            {/* 우측 — 상품 정보 */}
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold uppercase tracking-wider text-primary">
                {product.category}
              </span>

              <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-4xl">
                {product.title}
              </h1>

              {free ? (
                <p className="mt-4 font-display text-3xl font-bold text-primary">
                  무료 (Free)
                </p>
              ) : (
                <p className="mt-4 font-display text-3xl font-bold text-primary">
                  {formatPrice(product.price)}
                </p>
              )}

              {/* 잔여 수량 표시 */}
              {product.remaining_seats !== null && (
                <div className="mt-3">
                  {soldOut ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-sm font-semibold text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      수강 마감 (품절)
                    </span>
                  ) : product.remaining_seats <= 5 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500/15 px-3 py-1.5 text-sm font-semibold text-yellow-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                      남은 자리: {product.remaining_seats}명 (마감 임박)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 px-3 py-1.5 text-sm font-semibold text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      남은 자리: {product.remaining_seats}명
                    </span>
                  )}
                </div>
              )}

              <hr className="my-6 border-border" />

              <p className="text-base leading-relaxed text-white whitespace-pre-line">
                {product.description}
              </p>

              {/* 버튼 */}
              {soldOut ? (
                <div className="mt-8">
                  <button
                    disabled
                    className="w-full rounded-xl bg-border px-6 py-4 text-lg font-semibold text-sub-text cursor-not-allowed"
                  >
                    수강 마감 (품절)
                  </button>
                </div>
              ) : free ? (
                <div className="mt-8">
                  <button
                    onClick={handleFreeDownload}
                    disabled={freeLoading}
                    className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {freeLoading ? "처리 중..." : "무료 받기"}
                  </button>
                </div>
              ) : (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleAddCart}
                    disabled={cartLoading}
                    className="flex-1 rounded-xl border border-border px-6 py-4 text-base font-semibold text-white transition-all duration-200 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cartLoading ? "담는 중..." : "장바구니 담기"}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25"
                  >
                    바로 구매하기
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── 4:5 미디어 슬라이더 (상세 정보 바로 위) ── */}
          {product.slider_media && product.slider_media.length > 0 && (
            <div className="mt-16">
              <MediaSlider items={product.slider_media} title={product.title} />
            </div>
          )}

          {/* 상세 이미지 */}
          {product.detail_images && product.detail_images.length > 0 && (
            <div className="mt-16 space-y-6">
              <h2 className="text-xl font-bold text-white">상세 정보</h2>
              <div className="space-y-4">
                {product.detail_images.map((url, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-border">
                    <Image
                      src={url}
                      alt={`${product.title} 상세 이미지 ${i + 1}`}
                      width={1200}
                      height={800}
                      className="w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 800px"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ 아코디언 */}
          {product.faqs && product.faqs.length > 0 && (
            <div className="mt-16 space-y-6">
              <h2 className="text-xl font-bold text-white">
                자주 묻는 <span className="text-primary">질문</span>
              </h2>
              <div className="space-y-3">
                {product.faqs.map((faq, i) => (
                  <FaqAccordionItem key={i} q={faq.q} a={faq.a} />
                ))}
              </div>
            </div>
          )}

          {/* 환불 규정 아코디언 */}
          {product.refund_policy && product.refund_policy.length > 0 && (
            <div className="mt-16 space-y-6">
              <h2 className="text-xl font-bold text-white">
                환불 <span className="text-yellow-400">규정</span>
              </h2>
              <div className="space-y-3">
                {product.refund_policy.map((item, i) => (
                  <FaqAccordionItem key={i} q={item.q} a={item.a} accent="yellow" />
                ))}
              </div>
            </div>
          )}
        </FadeInSection>
      </section>
    </div>
  );
}

/* ── FAQ 아코디언 아이템 ── */
function FaqAccordionItem({ q, a, accent = "primary" }: { q: string; a: string; accent?: "primary" | "yellow" }) {
  const hoverBorder = accent === "yellow" ? "hover:border-yellow-400/30" : "hover:border-primary/30";
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border border-border bg-card transition-all duration-200 ${hoverBorder}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <span className="pr-4 text-base font-semibold text-white">{accent === "primary" ? `Q. ${q}` : q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 text-xl text-white"
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 pb-5 pt-4">
              <p className="text-base leading-relaxed text-white whitespace-pre-line">
                {accent === "primary" ? `A. ${a}` : a}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

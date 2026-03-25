"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import FadeInSection from "@/components/FadeInSection";
import { createClient } from "@/utils/supabase/client";

/* ── 타입 ── */
interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  thumbnail_url: string | null;
  sort_order: number;
}

const CATEGORIES = ["전체", "컬러 프리셋", "자막 템플릿", "효과음/BGM", "Free"] as const;
type Category = (typeof CATEGORIES)[number];

function formatPrice(n: number) {
  if (n === 0) return "무료 (Free)";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function ShopPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>("전체");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price, category, description, thumbnail_url, sort_order")
        .eq("type", "digital_asset")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("상품 조회 실패:", error.message);
      } else {
        setProducts((data as Product[]) ?? []);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const filtered =
    activeCategory === "전체"
      ? products
      : activeCategory === "Free"
        ? products.filter((p) => p.price === 0)
        : products.filter((p) => p.category === activeCategory);

  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <FadeInSection>
          <span className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
            Digital Asset Store
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl">
            크리에이터를 위한
            <br />
            <span className="text-primary">디지털 툴킷</span>
          </h1>
          <p className="mt-6 text-lg text-white">
            프리미어 프로에서 바로 쓸 수 있는 프리셋, 템플릿, 에셋을 만나보세요.
          </p>
        </FadeInSection>
      </section>

      {/* Category Filter Tabs */}
      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                activeCategory === cat
                  ? "bg-primary text-background shadow-lg shadow-primary/25"
                  : "border border-border bg-card text-white hover:border-primary/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Product Grid */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((product, i) => (
                <FadeInSection key={product.id} delay={i * 0.06}>
                  <Link href={`/shop/${product.id}`} className="block">
                    <div className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                      {/* 썸네일 */}
                      <div className="relative aspect-video overflow-hidden bg-border/30">
                        {product.thumbnail_url ? (
                          <Image
                            src={product.thumbnail_url}
                            alt={product.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-110">
                            <span className="font-display text-sm text-sub-text">
                              Thumbnail
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 카드 정보 */}
                      <div className="p-5">
                        <span className="font-display text-xs font-semibold uppercase tracking-wider text-primary">
                          {product.category}
                        </span>
                        <h3 className="mt-2 text-lg font-bold text-white">
                          {product.title}
                        </h3>
                        <div className="mt-4 flex items-center justify-between">
                          {product.price === 0 ? (
                            <span className="font-display text-xl font-bold text-primary">
                              무료 (Free)
                            </span>
                          ) : (
                            <span className="font-display text-xl font-bold text-primary">
                              {formatPrice(product.price)}
                            </span>
                          )}
                          <span className="rounded-lg bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary group-hover:text-background">
                            →
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </FadeInSection>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* 필터 결과 없음 */}
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-lg text-sub-text">
              해당 카테고리에 상품이 없습니다.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

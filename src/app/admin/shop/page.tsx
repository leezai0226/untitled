"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

/* ─── 타입 ─── */
interface FaqItem {
  q: string;
  a: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
  remaining_seats: number | null;
  faqs: FaqItem[] | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatPrice(n: number) {
  if (n === 0) return "무료";
  return `₩${n.toLocaleString("ko-KR")}`;
}

/* ─── 페이지 ─── */
export default function AdminShopPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortUpdating, setSortUpdating] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, title, price, category, thumbnail_url, sort_order, created_at, remaining_seats, faqs")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("상품 조회 실패:", error.message);
    } else {
      setProducts((data as Product[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ── API 호출 헬퍼 ── */
  const adminFetch = async (method: string, body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/products", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "요청 실패");
    return data;
  };

  /* ── 삭제 ── */
  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" 상품을 정말 삭제하시겠습니까?`)) return;
    setDeleting(id);

    try {
      await adminFetch("DELETE", { id });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
    setDeleting(null);
  };

  /* ── 순서 이동 (▲/▼) ── */
  const handleMove = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= products.length) return;

    const current = products[index];
    const target = products[swapIndex];
    setSortUpdating(current.id);

    const currentOrder = current.sort_order;
    const targetOrder = target.sort_order;

    const newCurrentOrder = targetOrder === currentOrder
      ? (direction === "up" ? currentOrder - 1 : currentOrder + 1)
      : targetOrder;
    const newTargetOrder = targetOrder === currentOrder
      ? currentOrder
      : currentOrder;

    try {
      await adminFetch("PUT", { id: current.id, sort_order: newCurrentOrder });
      await adminFetch("PUT", { id: target.id, sort_order: newTargetOrder });

      const updated = [...products];
      updated[index] = { ...current, sort_order: newCurrentOrder };
      updated[swapIndex] = { ...target, sort_order: newTargetOrder };
      updated.sort((a, b) => a.sort_order - b.sort_order);
      setProducts(updated);
    } catch {
      alert("순서 변경 실패");
    }
    setSortUpdating(null);
  };

  /* ── 순서 직접 입력 ── */
  const handleSortChange = async (id: string, newOrder: number) => {
    setSortUpdating(id);
    try {
      await adminFetch("PUT", { id, sort_order: newOrder });
      setProducts((prev) => {
        const updated = prev.map((p) =>
          p.id === id ? { ...p, sort_order: newOrder } : p
        );
        updated.sort((a, b) => a.sort_order - b.sort_order);
        return updated;
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "순서 변경 실패");
    }
    setSortUpdating(null);
  };

  /* ─── UI ─── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              상품 <span className="text-primary">관리</span>
            </h1>
            <p className="mt-1 text-base text-sub-text">
              총{" "}
              <span className="font-display font-semibold text-white">
                {products.length}
              </span>
              개 디지털 에셋
            </p>
          </div>
          <Link
            href="/admin/shop/new"
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
          >
            + 상품 등록
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="mt-20 text-center text-sub-text">
            <p>등록된 상품이 없습니다.</p>
            <Link
              href="/admin/shop/new"
              className="mt-4 inline-block text-primary hover:underline"
            >
              첫 상품 등록하기 →
            </Link>
          </div>
        ) : (
          <>
            {/* ── 데스크톱 테이블 ── */}
            <div className="mt-8 hidden md:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text w-16">
                      순서
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text">
                      썸네일
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text">
                      상품명
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text">
                      카테고리
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text">
                      가격
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text">
                      재고
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text">
                      FAQ
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text">
                      등록일
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text text-center">
                      이동
                    </th>
                    <th className="px-4 py-4 text-sm font-semibold text-sub-text text-center">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, idx) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-b-0 transition-colors hover:bg-card/50"
                    >
                      {/* 순서 입력 */}
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          value={p.sort_order}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              // 로컬 즉시 반영
                              setProducts((prev) =>
                                prev.map((item) =>
                                  item.id === p.id ? { ...item, sort_order: val } : item
                                )
                              );
                            }
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== p.sort_order) {
                              handleSortChange(p.id, val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          disabled={sortUpdating === p.id}
                          className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm text-white focus:border-primary focus:outline-none disabled:opacity-50"
                        />
                      </td>
                      {/* 썸네일 */}
                      <td className="px-4 py-4">
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt={p.title}
                            className="h-12 w-20 rounded-lg object-cover border border-border"
                          />
                        ) : (
                          <div className="flex h-12 w-20 items-center justify-center rounded-lg border border-border bg-card text-xs text-sub-text">
                            No img
                          </div>
                        )}
                      </td>
                      {/* 상품명 */}
                      <td className="px-4 py-4 text-sm font-medium text-white max-w-[200px] truncate">
                        {p.title}
                      </td>
                      {/* 카테고리 */}
                      <td className="px-4 py-4 text-xs text-sub-text whitespace-nowrap">
                        {p.category}
                      </td>
                      {/* 가격 */}
                      <td className="px-4 py-4 font-display text-sm font-semibold text-primary whitespace-nowrap">
                        {formatPrice(p.price)}
                      </td>
                      {/* 재고 */}
                      <td className="px-4 py-4 text-sm whitespace-nowrap">
                        {p.remaining_seats === null ? (
                          <span className="text-sub-text">무제한</span>
                        ) : p.remaining_seats <= 0 ? (
                          <span className="font-semibold text-red-400">품절</span>
                        ) : p.remaining_seats <= 5 ? (
                          <span className="font-semibold text-yellow-400">
                            {p.remaining_seats}명
                          </span>
                        ) : (
                          <span className="font-semibold text-green-400">
                            {p.remaining_seats}명
                          </span>
                        )}
                      </td>
                      {/* FAQ */}
                      <td className="px-4 py-4 text-sm whitespace-nowrap">
                        {p.faqs && p.faqs.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                            {p.faqs.length}개
                          </span>
                        ) : (
                          <span className="text-sub-text/50">—</span>
                        )}
                      </td>
                      {/* 등록일 */}
                      <td className="px-4 py-4 text-sm text-sub-text whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </td>
                      {/* 이동 버튼 */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleMove(idx, "up")}
                            disabled={idx === 0 || sortUpdating === p.id}
                            className="rounded-lg border border-border px-2 py-1 text-sm text-sub-text transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMove(idx, "down")}
                            disabled={idx === products.length - 1 || sortUpdating === p.id}
                            className="rounded-lg border border-border px-2 py-1 text-sm text-sub-text transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      {/* 액션 */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/shop/${p.id}/edit`}
                            className="rounded-lg border border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary transition-all duration-200 hover:bg-primary/10"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => handleDelete(p.id, p.title)}
                            disabled={deleting === p.id}
                            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-semibold text-red-400 transition-all duration-200 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleting === p.id ? "..." : "삭제"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── 모바일 카드 ── */}
            <div className="mt-8 space-y-4 md:hidden">
              {products.map((p, idx) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex gap-4">
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt={p.title}
                        className="h-16 w-24 shrink-0 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-xs text-sub-text">
                        No img
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-white">
                        {p.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-sub-text">{p.category}</p>
                      <p className="mt-1 font-display text-sm font-semibold text-primary">
                        {formatPrice(p.price)}
                      </p>
                      <p className="mt-0.5 text-xs text-sub-text">
                        {formatDate(p.created_at)}
                      </p>
                      <p className="mt-0.5 text-xs">
                        {p.remaining_seats === null ? (
                          <span className="text-sub-text">재고: 무제한</span>
                        ) : p.remaining_seats <= 0 ? (
                          <span className="font-semibold text-red-400">품절</span>
                        ) : (
                          <span className={p.remaining_seats <= 5 ? "font-semibold text-yellow-400" : "text-green-400"}>
                            남은 수량: {p.remaining_seats}명
                          </span>
                        )}
                      </p>
                      {p.faqs && p.faqs.length > 0 && (
                        <p className="mt-0.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            FAQ {p.faqs.length}개
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 순서 + 이동 */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-sub-text">진열 순서:</span>
                    <input
                      type="number"
                      value={p.sort_order}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setProducts((prev) =>
                            prev.map((item) =>
                              item.id === p.id ? { ...item, sort_order: val } : item
                            )
                          );
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) handleSortChange(p.id, val);
                      }}
                      className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm text-white focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={() => handleMove(idx, "up")}
                      disabled={idx === 0}
                      className="rounded-lg border border-border px-2 py-1 text-sm text-sub-text hover:text-primary disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMove(idx, "down")}
                      disabled={idx === products.length - 1}
                      className="rounded-lg border border-border px-2 py-1 text-sm text-sub-text hover:text-primary disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/admin/shop/${p.id}/edit`}
                      className="flex-1 rounded-xl border border-primary/30 py-2.5 text-center text-sm font-semibold text-primary transition-all duration-200 hover:bg-primary/10"
                    >
                      수정
                    </Link>
                    <button
                      onClick={() => handleDelete(p.id, p.title)}
                      disabled={deleting === p.id}
                      className="flex-1 rounded-xl border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 transition-all duration-200 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting === p.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Stats {
  totalProducts: number;
  pendingOrders: number;
  completedOrders: number;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { count: productCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("type", "digital_asset");

      const { count: pendingCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: completedCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      setStats({
        totalProducts: productCount ?? 0,
        pendingOrders: pendingCount ?? 0,
        completedOrders: completedCount ?? 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* 환영 메시지 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white md:text-4xl">
            관리자 <span className="text-primary">대시보드</span>
          </h1>
          <p className="mt-3 text-base text-sub-text">
            상품과 주문을 한눈에 관리하세요.
          </p>
        </div>

        {/* 요약 통계 */}
        {!loading && (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-sub-text">등록 상품</p>
              <p className="mt-1 font-display text-3xl font-bold text-white">
                {stats.totalProducts}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-sub-text">입금 대기</p>
              <p className="mt-1 font-display text-3xl font-bold text-yellow-400">
                {stats.pendingOrders}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-sub-text">결제 완료</p>
              <p className="mt-1 font-display text-3xl font-bold text-green-400">
                {stats.completedOrders}
              </p>
            </div>
          </div>
        )}

        {/* 네비게이션 카드 */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* 상품 관리 */}
          <Link href="/admin/shop" className="block group">
            <div className="rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl transition-colors group-hover:bg-primary/20">
                📦
              </div>
              <h2 className="mt-5 text-xl font-bold text-white">
                상품 관리
              </h2>
              <p className="mt-2 text-sm text-sub-text leading-relaxed">
                디지털 에셋 등록, 수정, 삭제 및 진열 순서를 관리합니다.
              </p>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                관리 페이지로 이동
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>

          {/* 클래스 좌석 관리 */}
          <Link href="/admin/class" className="block group">
            <div className="rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl transition-colors group-hover:bg-primary/20">
                🎓
              </div>
              <h2 className="mt-5 text-xl font-bold text-white">
                클래스 관리
              </h2>
              <p className="mt-2 text-sm text-sub-text leading-relaxed">
                브이로그/숏폼반 시간대별 잔여 좌석을 관리합니다.
              </p>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                관리 페이지로 이동
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>

          {/* 메인 링크 관리 */}
          <Link href="/admin/links" className="block group">
            <div className="rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl transition-colors group-hover:bg-primary/20">
                🔗
              </div>
              <h2 className="mt-5 text-xl font-bold text-white">
                메인 링크 관리
              </h2>
              <p className="mt-2 text-sm text-sub-text leading-relaxed">
                메인 페이지 링크 버튼을 추가·수정·순서 변경합니다.
              </p>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                관리 페이지로 이동
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>

          {/* 주문 관리 */}
          <Link href="/admin/orders" className="block group">
            <div className="relative rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
              {!loading && stats.pendingOrders > 0 && (
                <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-background shadow-lg">
                  {stats.pendingOrders}
                </div>
              )}
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl transition-colors group-hover:bg-primary/20">
                🧾
              </div>
              <h2 className="mt-5 text-xl font-bold text-white">
                주문 관리
              </h2>
              <p className="mt-2 text-sm text-sub-text leading-relaxed">
                수강 신청 및 상품 주문 내역을 확인하고 입금 상태를 관리합니다.
              </p>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                관리 페이지로 이동
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

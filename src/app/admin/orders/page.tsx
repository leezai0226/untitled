"use client";

/*
 * ──────────────────────────────────────────────────────────
 * 관리자 전용 주문 관리 대시보드  (/admin/orders)
 *
 * [보안 참고]
 * 현재는 테스트를 위해 접속 제한이 없습니다.
 * 향후 이 /admin 경로는 관리자(Admin) 권한을 가진 사용자만
 * 접근할 수 있도록 미들웨어 또는 RLS 기반으로 제한할 예정입니다.
 * (Supabase user_metadata.role === 'admin' 확인)
 * ──────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

/* ─────────────── 타입 ─────────────── */

interface Order {
  id: string;
  created_at: string;
  class_name: string | null;
  schedule: string | null;
  name: string | null;
  phone: string | null;
  payment_method: string | null;
  depositor_name: string | null;
  cash_receipt_number: string | null;
  experience_level: string | null;
  message: string | null;
  status: string;
}

/* ─────────────── 헬퍼 ─────────────── */

function formatDate(iso: string) {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day} ${hours}:${mins}`;
}

function paymentLabel(method: string | null) {
  if (method === "card") return "카드 결제";
  if (method === "bank_transfer") return "계좌 이체";
  return "—";
}

function statusBadge(status: string) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        결제 완료
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        취소됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-400">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      입금 대기
    </span>
  );
}

function experienceLabel(level: string | null) {
  if (level === "beginner") return "완전 처음";
  if (level === "basic") return "조금 배움";
  if (level === "intermediate") return "어느정도 가능";
  return "—";
}

/* ─────────────── 페이지 ─────────────── */

export default function AdminOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* ── 주문 목록 불러오기 ── */
  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("주문 조회 실패:", error.message);
    } else {
      setOrders((data as Order[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* ── 입금 확인 (status → completed) — 서버 API 경유 ── */
  const handleConfirm = async (orderId: string) => {
    if (!window.confirm("이 주문을 입금 확인 처리하시겠습니까?")) return;

    setConfirming(orderId);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: "completed" }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "상태 변경 실패");
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: "completed" } : o
          )
        );
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }
    setConfirming(null);
  };

  /* ─────────────── UI ─────────────── */

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
              📋 주문 <span className="text-primary">관리</span>
            </h1>
            <p className="mt-1 text-base text-sub-text">
              총 <span className="font-display font-semibold text-white">{orders.length}</span>건
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchOrders(); }}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:border-primary hover:text-primary"
          >
            새로고침
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="mt-20 text-center text-sub-text">
            아직 주문 내역이 없습니다.
          </div>
        ) : (
          <>
            {/* ── 데스크톱 테이블 (md 이상) ── */}
            <div className="mt-8 hidden md:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">주문일시</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">이름</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">연락처</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">클래스 / 일정</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">결제 수단</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">예금주</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">현금영수증</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">금액</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">상태</th>
                    <th className="px-5 py-4 text-sm font-semibold text-sub-text">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-b-0 transition-colors hover:bg-card/50"
                    >
                      <td className="px-5 py-4 text-sm text-white whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-white">
                        {order.name || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white whitespace-nowrap">
                        {order.phone || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        <div>{order.class_name || "—"}</div>
                        <div className="text-xs text-sub-text">{order.schedule || ""}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {paymentLabel(order.payment_method)}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {order.depositor_name || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {order.cash_receipt_number || "—"}
                      </td>
                      <td className="px-5 py-4 font-display text-sm font-semibold text-primary whitespace-nowrap">
                        299,000원
                      </td>
                      <td className="px-5 py-4">{statusBadge(order.status)}</td>
                      <td className="px-5 py-4">
                        {order.status === "pending" ? (
                          <button
                            onClick={() => handleConfirm(order.id)}
                            disabled={confirming === order.id}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {confirming === order.id ? "처리 중..." : "입금 확인"}
                          </button>
                        ) : (
                          <span className="text-sm text-sub-text">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── 모바일 카드 리스트 (md 미만) ── */}
            <div className="mt-8 space-y-4 md:hidden">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  {/* 상단: 이름 + 상태 */}
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-white">
                      {order.name || "—"}
                    </span>
                    {statusBadge(order.status)}
                  </div>

                  {/* 기본 정보 */}
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-sub-text">주문일시</span>
                      <span className="text-white">{formatDate(order.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sub-text">연락처</span>
                      <span className="text-white">{order.phone || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sub-text">클래스</span>
                      <span className="text-white text-right">{order.class_name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sub-text">일정</span>
                      <span className="text-white text-right">{order.schedule || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sub-text">결제 수단</span>
                      <span className="text-white">{paymentLabel(order.payment_method)}</span>
                    </div>
                    {order.payment_method === "bank_transfer" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sub-text">예금주</span>
                          <span className="text-white">{order.depositor_name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sub-text">현금영수증</span>
                          <span className="text-white">{order.cash_receipt_number || "—"}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sub-text">금액</span>
                      <span className="font-display font-semibold text-primary">299,000원</span>
                    </div>
                  </div>

                  {/* 상세 토글 */}
                  {(order.experience_level || order.message) && (
                    <button
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      className="mt-3 text-xs text-primary hover:underline"
                    >
                      {expandedId === order.id ? "상세 접기 ▲" : "상세 보기 ▼"}
                    </button>
                  )}
                  {expandedId === order.id && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-sub-text">편집 경험</span>
                        <span className="text-white">{experienceLabel(order.experience_level)}</span>
                      </div>
                      {order.message && (
                        <div>
                          <span className="text-sub-text">메시지</span>
                          <p className="mt-1 text-white leading-relaxed">{order.message}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 입금 확인 버튼 */}
                  {order.status === "pending" && (
                    <button
                      onClick={() => handleConfirm(order.id)}
                      disabled={confirming === order.id}
                      className="mt-4 w-full rounded-xl bg-primary py-3 text-base font-semibold text-background transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {confirming === order.id ? "처리 중..." : "입금 확인"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

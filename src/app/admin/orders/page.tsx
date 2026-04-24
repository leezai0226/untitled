"use client";

import { useEffect, useState, useCallback } from "react";

/* ─────────────── 타입 ─────────────── */

interface Order {
  id: string;
  created_at: string;
  order_type: string | null;
  class_name: string | null;
  schedule: string | null;
  name: string | null;
  phone: string | null;
  payment_method: string | null;
  depositor_name: string | null;
  cash_receipt_number: string | null;
  experience_level: string | null;
  message: string | null;
  total_amount: number | null;
  status: string;
  // 비회원 주문 식별용
  user_id: string | null;
  guest_email: string | null;
  guest_phone: string | null;
}

/** 비회원 주문 표시용 작은 배지 */
function GuestBadge({ email }: { email: string | null }) {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-400 align-middle"
      title={email || "비회원 주문"}
    >
      비회원
    </span>
  );
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
  if (method === "portone") return "카드 결제";
  if (method === "card") return "카드 결제";
  if (method === "bank_transfer") return "계좌이체";
  return method || "—";
}

function statusBadge(status: string) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        결제완료
      </span>
    );
  }
  if (status === "cancelled" || status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        {status === "refunded" ? "환불" : "취소"}
      </span>
    );
  }
  if (status === "refund_requested") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-orange-400/15 px-3 py-1 text-xs font-semibold text-orange-400 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
        환불 신청
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-yellow-500/15 px-3 py-1 text-xs font-semibold text-yellow-400 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      입금대기
    </span>
  );
}

function experienceLabel(level: string | null) {
  if (level === "beginner") return "완전 처음";
  if (level === "basic") return "조금 배움";
  if (level === "intermediate") return "어느정도 가능";
  return "—";
}

function formatAmount(amount: number | null) {
  if (!amount) return "—";
  return `₩${amount.toLocaleString("ko-KR")}`;
}

/* ─────────────── 페이지 ─────────────── */

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 가장 최근 주문이 있는 탭이 자동으로 활성화됨 (orders 로드 후 1회만)
  const [activeTab, setActiveTab] = useState<"class" | "shop">("shop");
  const [tabAutoSelected, setTabAutoSelected] = useState(false);

  /* ── 주문 목록 불러오기 (서버 API 경유) ── */
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) {
        console.error("주문 조회 실패:", res.status);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setOrders((data.orders as Order[]) ?? []);
    } catch (err) {
      console.error("주문 조회 에러:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* ── 필터링 ── */
  const classOrders = orders.filter((o) => o.order_type === "class");
  const shopOrders = orders.filter((o) => o.order_type !== "class");
  const filteredOrders = activeTab === "class" ? classOrders : shopOrders;

  /* ── 첫 로드 시 가장 최근 주문이 있는 탭으로 자동 전환 ── */
  useEffect(() => {
    if (tabAutoSelected || orders.length === 0) return;
    const latestClass = classOrders[0]?.created_at;
    const latestShop = shopOrders[0]?.created_at;
    if (latestClass && (!latestShop || latestClass > latestShop)) {
      setActiveTab("class");
    } else {
      setActiveTab("shop");
    }
    setTabAutoSelected(true);
  }, [orders, classOrders, shopOrders, tabAutoSelected]);

  /* ── 입금 확인 ── */
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

        // 이메일 전송 상태 피드백
        const emailStatus = data.emailSent
          ? "✓ 입금 확인 완료\n✓ 고객 이메일 전송됨"
          : data.emailError
            ? `✓ 입금 확인 완료\n⚠ 이메일 전송 실패: ${data.emailError}\n(고객에게 별도로 안내 필요)`
            : "✓ 입금 확인 완료\n(이메일 미발송 - 비회원 주문이 아니거나 이메일 없음)";

        alert(emailStatus);
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }
    setConfirming(null);
  };

  /* ── 환불 승인 (계좌이체 수동 처리) ── */
  const handleApproveRefund = async (orderId: string) => {
    if (
      !window.confirm(
        "이 주문의 환불을 승인 처리하시겠습니까?\n\n계좌로 송금을 완료한 후에 진행해 주세요. 주문 상태가 환불 완료로 변경됩니다."
      )
    ) {
      return;
    }

    setApproving(orderId);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, action: "approve_refund" }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "환불 승인 실패");
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: "refunded" } : o
          )
        );

        // 이메일 전송 상태 피드백
        const emailStatus = data.emailSent
          ? "✓ 환불 승인 완료\n✓ 고객 이메일 전송됨"
          : data.emailError
            ? `✓ 환불 승인 완료\n⚠ 이메일 전송 실패: ${data.emailError}\n(고객에게 별도로 안내 필요)`
            : "✓ 환불 승인 완료\n(이메일 미발송 - 비회원 주문이 아니거나 이메일 없음)";

        alert(emailStatus);
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }
    setApproving(null);
  };

  /* ── 주문 삭제(숨김) ── */
  const handleDelete = async (orderId: string) => {
    if (!window.confirm("이 주문을 목록에서 삭제(숨김)하시겠습니까?")) return;

    setDeleting(orderId);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "삭제 실패");
      } else {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }
    setDeleting(null);
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

        {/* 탭 */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setActiveTab("class")}
            className={`flex-1 rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 ${
              activeTab === "class"
                ? "bg-primary text-background"
                : "border border-border bg-card text-white hover:border-primary/50"
            }`}
          >
            🎬 클래스 주문 ({classOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("shop")}
            className={`flex-1 rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 ${
              activeTab === "shop"
                ? "bg-primary text-background"
                : "border border-border bg-card text-white hover:border-primary/50"
            }`}
          >
            🛒 Shop 주문 ({shopOrders.length})
          </button>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="mt-20 text-center text-sub-text">
            {activeTab === "class" ? "클래스" : "Shop"} 주문 내역이 없습니다.
          </div>
        ) : (
          <>
            {/* ── 데스크톱 테이블 ── */}
            <div className="mt-6 hidden md:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">주문일시</th>
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">이름</th>
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">연락처</th>
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">
                      {activeTab === "class" ? "클래스 / 일정" : "주문 유형"}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">결제수단</th>
                    {activeTab === "class" && (
                      <>
                        <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">예금주</th>
                        <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">현금영수증</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">금액</th>
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">상태</th>
                    <th className="px-4 py-3 text-xs font-semibold text-sub-text whitespace-nowrap">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-b-0 transition-colors hover:bg-card/50"
                    >
                      <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">
                        <span>{order.name || "—"}</span>
                        {!order.user_id && <GuestBadge email={order.guest_email} />}
                        {!order.user_id && order.guest_email && (
                          <div className="mt-0.5 text-[11px] font-normal text-sub-text">
                            {order.guest_email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                        {order.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                        {activeTab === "class" ? (
                          <div>
                            <div>{order.class_name || "—"}</div>
                            <div className="text-xs text-sub-text">{order.schedule || ""}</div>
                          </div>
                        ) : (
                          <span>디지털 에셋</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                        {paymentLabel(order.payment_method)}
                      </td>
                      {activeTab === "class" && (
                        <>
                          <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                            {order.depositor_name || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                            {order.cash_receipt_number || "—"}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 font-display text-sm font-semibold text-primary whitespace-nowrap">
                        {formatAmount(order.total_amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusBadge(order.status)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {order.status === "pending" && (
                            <button
                              onClick={() => handleConfirm(order.id)}
                              disabled={confirming === order.id}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {confirming === order.id ? "..." : "입금확인"}
                            </button>
                          )}
                          {order.status === "refund_requested" &&
                            order.payment_method === "bank_transfer" && (
                              <button
                                onClick={() => handleApproveRefund(order.id)}
                                disabled={approving === order.id}
                                className="rounded-lg bg-orange-400 px-3 py-1.5 text-xs font-semibold text-background transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {approving === order.id ? "..." : "환불 승인"}
                              </button>
                            )}
                          <button
                            onClick={() => handleDelete(order.id)}
                            disabled={deleting === order.id}
                            className="rounded-lg border border-border px-2 py-1.5 text-xs text-sub-text transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                            title="삭제(숨김)"
                          >
                            {deleting === order.id ? "..." : "✕"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── 모바일 카드 리스트 ── */}
            <div className="mt-6 space-y-4 md:hidden">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="relative rounded-xl border border-border bg-card p-5"
                >
                  {/* 삭제 버튼 (우측 상단) */}
                  <button
                    onClick={() => handleDelete(order.id)}
                    disabled={deleting === order.id}
                    className="absolute right-3 top-3 rounded-lg border border-border px-2 py-1 text-xs text-sub-text transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                  >
                    {deleting === order.id ? "..." : "✕"}
                  </button>

                  {/* 상단: 이름 + 상태 */}
                  <div className="flex items-center gap-3 pr-8">
                    <span className="text-base font-semibold text-white whitespace-nowrap">
                      {order.name || "—"}
                    </span>
                    {!order.user_id && <GuestBadge email={order.guest_email} />}
                    {statusBadge(order.status)}
                  </div>
                  {!order.user_id && order.guest_email && (
                    <div className="mt-1 text-xs text-sub-text">
                      ✉ {order.guest_email}
                    </div>
                  )}

                  {/* 기본 정보 */}
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-sub-text whitespace-nowrap">주문일시</span>
                      <span className="text-white whitespace-nowrap">{formatDate(order.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sub-text whitespace-nowrap">연락처</span>
                      <span className="text-white whitespace-nowrap">{order.phone || "—"}</span>
                    </div>
                    {activeTab === "class" ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sub-text whitespace-nowrap">클래스</span>
                          <span className="text-white text-right">{order.class_name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sub-text whitespace-nowrap">일정</span>
                          <span className="text-white text-right">{order.schedule || "—"}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-sub-text whitespace-nowrap">유형</span>
                        <span className="text-white">디지털 에셋</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sub-text whitespace-nowrap">결제수단</span>
                      <span className="text-white whitespace-nowrap">{paymentLabel(order.payment_method)}</span>
                    </div>
                    {activeTab === "class" && order.payment_method === "bank_transfer" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sub-text whitespace-nowrap">예금주</span>
                          <span className="text-white whitespace-nowrap">{order.depositor_name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sub-text whitespace-nowrap">현금영수증</span>
                          <span className="text-white whitespace-nowrap">{order.cash_receipt_number || "—"}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sub-text whitespace-nowrap">금액</span>
                      <span className="font-display font-semibold text-primary whitespace-nowrap">
                        {formatAmount(order.total_amount)}
                      </span>
                    </div>
                  </div>

                  {/* 상세 토글 (클래스 전용) */}
                  {activeTab === "class" && (order.experience_level || order.message) && (
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

                  {/* 환불 승인 버튼 (계좌이체 환불 신청 건) */}
                  {order.status === "refund_requested" &&
                    order.payment_method === "bank_transfer" && (
                      <button
                        onClick={() => handleApproveRefund(order.id)}
                        disabled={approving === order.id}
                        className="mt-4 w-full rounded-xl bg-orange-400 py-3 text-base font-semibold text-background transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {approving === order.id ? "처리 중..." : "환불 승인"}
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

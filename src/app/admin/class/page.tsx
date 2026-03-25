"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface ScheduleRow {
  id: string;
  class_type: string;
  schedule_label: string;
  max_seats: number;
  remaining_seats: number;
}

const CLASS_LABELS: Record<string, string> = {
  vlog: "🎬 감성 브이로그 반",
  shortform: "📱 생존 숏폼 마케팅 반",
};

export default function AdminClassPage() {
  const supabase = createClient();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from("class_schedules")
      .select("*")
      .order("class_type")
      .order("created_at");

    if (error) {
      console.error("조회 실패:", error.message);
    } else {
      setSchedules((data as ScheduleRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleSave = async (id: string) => {
    const newSeats = editing[id];
    if (newSeats === undefined) return;

    setSaving(id);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, remaining_seats: newSeats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");

      setSchedules((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, remaining_seats: newSeats } : s
        )
      );
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "수정 실패");
    }
    setSaving(null);
  };

  const grouped = {
    vlog: schedules.filter((s) => s.class_type === "vlog"),
    shortform: schedules.filter((s) => s.class_type === "shortform"),
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
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          클래스 <span className="text-primary">좌석 관리</span>
        </h1>
        <p className="mt-2 text-base text-sub-text">
          시간대별 잔여 좌석을 확인하고 수정하세요. 결제 시 자동 차감됩니다.
        </p>

        {(["vlog", "shortform"] as const).map((type) => (
          <div key={type} className="mt-10">
            <h2 className="text-lg font-bold text-white">
              {CLASS_LABELS[type]}
            </h2>

            <div className="mt-4 space-y-3">
              {grouped[type].length === 0 ? (
                <p className="text-sm text-sub-text">등록된 일정이 없습니다.</p>
              ) : (
                grouped[type].map((s) => {
                  const isEditing = editing[s.id] !== undefined;
                  const currentValue = isEditing
                    ? editing[s.id]
                    : s.remaining_seats;
                  const isSoldOut = s.remaining_seats <= 0;
                  const isUrgent =
                    s.remaining_seats > 0 && s.remaining_seats <= 2;

                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4"
                    >
                      {/* 일정명 + 현재 상태 */}
                      <div className="min-w-0 flex-1 mr-4">
                        <p className="text-base font-semibold text-white">
                          {s.schedule_label}
                        </p>
                        <p
                          className={`mt-1 text-sm font-medium ${
                            isSoldOut
                              ? "text-red-400"
                              : isUrgent
                                ? "text-yellow-400"
                                : "text-green-400"
                          }`}
                        >
                          {isSoldOut
                            ? "마감"
                            : `${s.remaining_seats}/${s.max_seats}명 남음`}
                        </p>
                      </div>

                      {/* 인라인 수정 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            setEditing((prev) => ({
                              ...prev,
                              [s.id]: Math.max(0, currentValue - 1),
                            }))
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-white transition-colors hover:border-primary/50 hover:text-primary"
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min={0}
                          max={s.max_seats}
                          value={currentValue}
                          onChange={(e) => {
                            const v = Math.max(
                              0,
                              Math.min(s.max_seats, parseInt(e.target.value) || 0)
                            );
                            setEditing((prev) => ({ ...prev, [s.id]: v }));
                          }}
                          className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-center font-display text-base font-bold text-white focus:border-primary focus:outline-none"
                        />

                        <button
                          onClick={() =>
                            setEditing((prev) => ({
                              ...prev,
                              [s.id]: Math.min(s.max_seats, currentValue + 1),
                            }))
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-white transition-colors hover:border-primary/50 hover:text-primary"
                        >
                          +
                        </button>

                        {isEditing && (
                          <button
                            onClick={() => handleSave(s.id)}
                            disabled={saving === s.id}
                            className="ml-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-background transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                          >
                            {saving === s.id ? "..." : "저장"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

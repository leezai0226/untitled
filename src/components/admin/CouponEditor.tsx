"use client";

/**
 * 상품 등록/수정 폼 공용 쿠폰 편집기
 * - 코드 / 할인방식(%·원) / 할인값 / 수량(비우면 무제한) / 활성 토글
 * - used_count 는 읽기 전용으로 표시만
 */

export interface CouponDraft {
  id?: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number | "";
  max_uses: number | "";
  is_active: boolean;
  used_count?: number;
}

export function emptyCoupon(): CouponDraft {
  return {
    code: "",
    discount_type: "percent",
    discount_value: "",
    max_uses: "",
    is_active: true,
  };
}

interface Props {
  coupons: CouponDraft[];
  onChange: (next: CouponDraft[]) => void;
}

export default function CouponEditor({ coupons, onChange }: Props) {
  const update = (idx: number, patch: Partial<CouponDraft>) => {
    const next = coupons.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(coupons.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-6">
      <label className="block text-sm font-medium text-sub-text mb-2">
        쿠폰 코드
      </label>

      <div className="space-y-3">
        {coupons.map((c, idx) => (
          <div
            key={c.id ?? `new-${idx}`}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* 코드 */}
              <input
                type="text"
                value={c.code}
                onChange={(e) =>
                  update(idx, { code: e.target.value.toUpperCase() })
                }
                placeholder="코드 (예: LAUNCH20)"
                className="w-40 flex-1 min-w-[130px] rounded-lg border border-border bg-background px-3 py-2.5 font-display text-sm tracking-wider text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />

              {/* 방식 */}
              <select
                value={c.discount_type}
                onChange={(e) =>
                  update(idx, {
                    discount_type: e.target.value as "percent" | "fixed",
                  })
                }
                className="rounded-lg border border-border bg-background px-2.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              >
                <option value="percent">% 할인</option>
                <option value="fixed">원 할인</option>
              </select>

              {/* 값 */}
              <input
                type="number"
                min={1}
                value={c.discount_value}
                onChange={(e) =>
                  update(idx, {
                    discount_value:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                placeholder={c.discount_type === "percent" ? "20" : "5000"}
                className="w-24 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />

              {/* 수량 */}
              <input
                type="number"
                min={1}
                value={c.max_uses}
                onChange={(e) =>
                  update(idx, {
                    max_uses:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                placeholder="수량 (비우면 무제한)"
                className="w-40 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />

              {/* 활성 토글 */}
              <button
                type="button"
                onClick={() => update(idx, { is_active: !c.is_active })}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  c.is_active ? "bg-primary" : "bg-border"
                }`}
                title={c.is_active ? "사용 가능" : "비활성"}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    c.is_active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>

              {/* 삭제 */}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-lg border border-border px-3 py-2 text-xs text-sub-text transition-colors hover:border-red-400/50 hover:text-red-400"
              >
                삭제
              </button>
            </div>

            {/* 사용 현황 (기존 쿠폰만) */}
            {c.id && (
              <p className="mt-2 text-xs text-sub-text">
                사용 {c.used_count ?? 0}
                {c.max_uses !== "" && c.max_uses !== null
                  ? ` / ${c.max_uses}`
                  : " (무제한)"}
                {!c.is_active && " · 비활성"}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...coupons, emptyCoupon()])}
        className="mt-3 rounded-xl bg-primary/15 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/25"
      >
        + 쿠폰 추가
      </button>
      <p className="mt-1.5 text-xs text-sub-text/60">
        구매자가 결제 페이지에서 코드를 입력하면 이 상품 가격에서 할인됩니다.
      </p>
    </div>
  );
}

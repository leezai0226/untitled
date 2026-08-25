/**
 * 상품 예약 오픈 유틸
 *
 * release_at  — 이 시각이 지나야 구매 가능. null 이면 즉시 판매.
 * release_mode — 오픈 전 노출 방식
 *   · "teaser" : 목록/상세에 보이되 카운트다운 + 구매 잠금
 *   · "hidden" : 오픈 시각까지 목록에서 완전히 숨김
 */

export interface ReleaseFields {
  release_at?: string | null;
  release_mode?: string | null;
}

/** 아직 오픈 전인가 */
export function isUpcoming(p: ReleaseFields, now: Date = new Date()): boolean {
  if (!p.release_at) return false;
  return new Date(p.release_at).getTime() > now.getTime();
}

/** 목록에서 감춰야 하는가 (hidden 모드 + 오픈 전) */
export function isHiddenBeforeRelease(
  p: ReleaseFields,
  now: Date = new Date()
): boolean {
  return isUpcoming(p, now) && p.release_mode === "hidden";
}

/** 오픈까지 남은 밀리초 (이미 열렸으면 0) */
export function msUntilRelease(
  p: ReleaseFields,
  now: Date = new Date()
): number {
  if (!p.release_at) return 0;
  return Math.max(0, new Date(p.release_at).getTime() - now.getTime());
}

/** "2일 03:14:22" 형태 카운트다운 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  return days > 0 ? `${days}일 ${hms}` : hms;
}

/** "12월 25일 (목) 오후 8:00" 형태 */
export function formatReleaseDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── 관리자 폼 <input type="datetime-local"> 변환 ── */

/** ISO → "YYYY-MM-DDTHH:mm" (브라우저 로컬 시간대 기준) */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" → ISO (빈 값이면 null) */
export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

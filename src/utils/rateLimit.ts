import { LRUCache } from "lru-cache";
import { NextRequest, NextResponse } from "next/server";

/* ──────────────────────────────────────────────────────────
 * 메모리 기반 Rate Limiter (lru-cache)
 *
 * Redis 없이 가볍게 사용할 수 있는 IP 기반 트래픽 제한 유틸리티.
 * 서버리스 환경에서는 인스턴스마다 독립 캐시이므로
 * 완벽하진 않지만, 단일 인스턴스 / 소규모 트래픽에서 충분합니다.
 * ────────────────────────────────────────────────────────── */

interface RateLimitOptions {
  /** 윈도우 시간(ms). 예: 60_000 = 1분 */
  windowMs: number;
  /** 윈도우 내 최대 허용 요청 수 */
  maxRequests: number;
}

interface TokenBucket {
  count: number;
  resetAt: number;
}

/**
 * 경로별로 독립적인 Rate Limiter를 생성합니다.
 *
 * ```ts
 * const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });
 *
 * export async function POST(req: NextRequest) {
 *   const blocked = limiter(req);
 *   if (blocked) return blocked; // 429 응답
 *   // ... 정상 로직
 * }
 * ```
 */
export function createRateLimiter({ windowMs, maxRequests }: RateLimitOptions) {
  const cache = new LRUCache<string, TokenBucket>({
    max: 2000, // 최대 2000개 IP 추적
    ttl: windowMs,
  });

  /**
   * 요청을 검사하고, 제한 초과 시 429 NextResponse를 반환합니다.
   * 정상이면 null을 반환합니다.
   */
  return function checkRateLimit(req: NextRequest): NextResponse | null {
    const ip = getClientIp(req);
    const now = Date.now();
    const existing = cache.get(ip);

    if (!existing || now > existing.resetAt) {
      // 새 윈도우 시작
      cache.set(ip, { count: 1, resetAt: now + windowMs });
      return null;
    }

    existing.count += 1;

    if (existing.count > maxRequests) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      return NextResponse.json(
        {
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
          },
        },
      );
    }

    // 카운트 업데이트 (LRU 캐시에 재설정)
    cache.set(ip, existing);
    return null;
  };
}

/* ── IP 추출 헬퍼 ── */
function getClientIp(req: NextRequest): string {
  // Vercel / 프록시 환경
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  // fallback
  return "unknown";
}

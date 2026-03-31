/**
 * 텍스트 입력값에서 HTML/스크립트 태그를 모두 제거합니다.
 * DB에 저장하기 직전에 반드시 호출하세요.
 *
 * - 모든 HTML 태그 제거
 * - &lt;script&gt;, onerror, onclick 등 XSS 벡터 차단
 * - 앞뒤 공백 제거 (trim)
 */
export function sanitize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "") // HTML 태그 제거
    .replace(/on\w+\s*=/gi, "") // 이벤트 핸들러 제거 (onclick=, onerror= 등)
    .replace(/javascript\s*:/gi, "") // javascript: 프로토콜 제거
    .replace(/data\s*:/gi, "") // data: 프로토콜 제거
    .trim();
}

/**
 * 객체의 모든 string 값을 sanitize 합니다.
 * 중첩 객체는 처리하지 않습니다 (1-depth only).
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    if (typeof result[key] === "string") {
      (result as Record<string, unknown>)[key] = sanitize(result[key] as string);
    }
  }
  return result;
}

import { NextRequest, NextResponse } from "next/server";

/* ── GET /api/og-fetch?url=https://... ── */
/* URL의 OG 이미지 또는 파비콘을 추출해 반환 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  // URL 파라미터 없으면 null 반환
  if (!targetUrl) {
    return NextResponse.json({ imageUrl: null });
  }

  try {
    // 외부 URL fetch (3초 타임아웃)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        // 일반 브라우저처럼 요청해 차단 방지
        "User-Agent":
          "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ imageUrl: null });
    }

    const html = await res.text();

    // og:image 메타태그 추출 시도
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (ogImageMatch?.[1]) {
      const imageUrl = resolveUrl(ogImageMatch[1], targetUrl);
      return NextResponse.json({ imageUrl });
    }

    // og:image 없으면 favicon 추출 시도
    const faviconMatch =
      html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);

    if (faviconMatch?.[1]) {
      const imageUrl = resolveUrl(faviconMatch[1], targetUrl);
      return NextResponse.json({ imageUrl });
    }

    // 둘 다 없으면 기본 /favicon.ico 시도
    const origin = new URL(targetUrl).origin;
    return NextResponse.json({ imageUrl: `${origin}/favicon.ico` });
  } catch {
    // 외부 URL 접근 실패 시 null 반환 (에러 던지지 않음)
    return NextResponse.json({ imageUrl: null });
  }
}

/* 상대 URL을 절대 URL로 변환하는 헬퍼 */
function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

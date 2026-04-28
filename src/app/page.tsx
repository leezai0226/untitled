import { createClient as createServiceClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";

/* ── DB에서 가져오는 링크 타입 (type, metadata 포함) ── */
interface MainLink {
  id: string;
  title: string;
  url: string;
  type: string;
  metadata: Record<string, unknown>;
}

async function getActiveLinks(): Promise<MainLink[]> {
  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("main_links")
      .select("id, title, url, type, metadata")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

/* ── spacer 크기별 클래스 ── */
function getSpacerClass(size: string | undefined): string {
  if (size === "small") return "h-4";
  if (size === "large") return "h-16";
  return "h-8"; // medium 또는 미지정
}

export default async function HomePage() {
  const links = await getActiveLinks();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-20">
      <div className="w-full max-w-md">

        {/* ── 프로필 영역 ── */}
        <div className="flex flex-col items-center text-center">
          {/* 프로필 이미지 */}
          <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-primary/40 shadow-lg shadow-primary/10">
            <Image
              src="/profile.jpg"
              alt="동그란문"
              width={96}
              height={96}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          {/* 브랜드 이름 */}
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">
            무제
          </h1>

          {/* 한 줄 소개 */}
          <p className="mt-2 text-sm leading-relaxed text-sub-text">
            영상편집은 쉽고 퀄리티 있게 · 영상편집 디지털 에셋
          </p>
        </div>

        {/* ── 링크 버튼 목록 ── */}
        <div className="mt-10 flex flex-col gap-3">
          {links.length === 0 ? (
            <p className="text-center text-sm text-sub-text">준비 중입니다.</p>
          ) : (
            links.map((link) => {
              /* ── spacer: 단순 여백 렌더링 ── */
              if (link.type === "spacer") {
                const size = link.metadata?.size as string | undefined;
                return (
                  <div
                    key={link.id}
                    className={getSpacerClass(size)}
                    aria-hidden="true"
                  />
                );
              }

              /* ── text: 텍스트 블록 렌더링 ── */
              if (link.type === "text") {
                const content = (link.metadata?.content as string) ?? link.title;
                return (
                  <p
                    key={link.id}
                    className="text-sm text-sub-text text-center px-2 py-2"
                  >
                    {content}
                  </p>
                );
              }

              /* ── link: 버튼 렌더링 (썸네일 포함 가능) ── */
              const isExternal =
                link.url.startsWith("http://") ||
                link.url.startsWith("https://");
              const thumbnailUrl = link.metadata?.thumbnail_url as string | undefined;

              const commonClass =
                "group flex w-full items-center justify-between rounded-2xl border border-border bg-card px-6 py-4 text-left font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:shadow-lg hover:shadow-primary/10";

              const inner = (
                <>
                  {/* 썸네일이 있으면 왼쪽에 표시 */}
                  <div className="flex items-center gap-3 min-w-0">
                    {thumbnailUrl && (
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={thumbnailUrl}
                          alt={link.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <span className="truncate">{link.title}</span>
                  </div>
                  <span className="text-primary opacity-60 transition-opacity group-hover:opacity-100 flex-shrink-0 ml-2">
                    {isExternal ? "↗" : "→"}
                  </span>
                </>
              );

              return isExternal ? (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={commonClass}
                >
                  {inner}
                </a>
              ) : (
                <Link key={link.id} href={link.url} className={commonClass}>
                  {inner}
                </Link>
              );
            })
          )}
        </div>

        {/* ── 하단 크레딧 ── */}
        <p className="mt-12 text-center text-xs text-sub-text/40">
          © {new Date().getFullYear()} untitled-studio
        </p>
      </div>
    </div>
  );
}

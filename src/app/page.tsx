import { createClient as createServiceClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";

interface MainLink {
  id: string;
  title: string;
  url: string;
}

async function getActiveLinks(): Promise<MainLink[]> {
  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("main_links")
      .select("id, title, url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
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
              const isExternal =
                link.url.startsWith("http://") ||
                link.url.startsWith("https://");
              const commonClass =
                "group flex w-full items-center justify-between rounded-2xl border border-border bg-card px-6 py-4 text-left font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:shadow-lg hover:shadow-primary/10";

              return isExternal ? (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={commonClass}
                >
                  <span>{link.title}</span>
                  <span className="text-primary opacity-60 transition-opacity group-hover:opacity-100">
                    ↗
                  </span>
                </a>
              ) : (
                <Link key={link.id} href={link.url} className={commonClass}>
                  <span>{link.title}</span>
                  <span className="text-primary opacity-60 transition-opacity group-hover:opacity-100">
                    →
                  </span>
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

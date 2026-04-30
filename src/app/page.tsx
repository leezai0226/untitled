import { createClient as createServiceClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";

// 항상 최신 데이터를 가져오도록 캐시 비활성화
export const dynamic = "force-dynamic";

/* ── DB에서 가져오는 링크 타입 (type, metadata 포함) ── */
interface MainLink {
  id: string;
  title: string;
  url: string;
  type: string;
  metadata: Record<string, unknown>;
}

/* ── 그룹 링크 항목 타입 ── */
interface GroupItem {
  label: string;
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

/* ── YouTube URL에서 video ID 추출 ── */
function extractYouTubeId(url: string): string | null {
  const shortMatch = url.match(/youtu\.be\/([^?&\s]+)/);
  if (shortMatch) return shortMatch[1];
  const longMatch = url.match(/[?&]v=([^&\s]+)/);
  if (longMatch) return longMatch[1];
  return null;
}

/* ── SoundCloud 여부 판별 ── */
function isSoundCloudUrl(url: string): boolean {
  return url.includes("soundcloud.com");
}

/* ── SNS 플랫폼별 이모지 반환 ── */
function getSnsEmoji(platform: string): string {
  const map: Record<string, string> = {
    instagram: "📷",
    youtube: "▶️",
    twitter: "🐦",
    tiktok: "🎵",
    facebook: "👥",
    linkedin: "💼",
  };
  return map[platform] ?? "🔗";
}

export default async function HomePage() {
  const links = await getActiveLinks();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-20">
      <div className="w-full max-w-md">

        {/* ── 프로필 영역 ── */}
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-primary/40 shadow-lg shadow-primary/10">
            <Image
              src="/profile.jpg"
              alt="무제"
              width={96}
              height={96}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">
            무제
          </h1>

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

              /* ── spacer ── */
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

              /* ── text ── */
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

              /* ── group ── */
              if (link.type === "group") {
                const items = Array.isArray(link.metadata?.items)
                  ? (link.metadata.items as GroupItem[])
                  : [];
                return (
                  <div
                    key={link.id}
                    className="rounded-2xl border border-border bg-card px-6 py-4"
                  >
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sub-text">
                      {link.title}
                    </p>
                    <div className="flex flex-col">
                      {items.map((item, idx) => {
                        const isExternal =
                          item.url.startsWith("http://") ||
                          item.url.startsWith("https://");
                        const itemClass =
                          "flex items-center justify-between py-3 text-sm font-semibold text-white transition-colors hover:text-primary" +
                          (idx < items.length - 1
                            ? " border-b border-border/40"
                            : "");
                        return isExternal ? (
                          <a
                            key={idx}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={itemClass}
                          >
                            <span>{item.label}</span>
                            <span className="text-primary/60 text-xs">↗</span>
                          </a>
                        ) : (
                          <Link key={idx} href={item.url} className={itemClass}>
                            <span>{item.label}</span>
                            <span className="text-primary/60 text-xs">→</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              /* ── sns ── */
              if (link.type === "sns") {
                const platform = (link.metadata?.platform as string) ?? "";
                const snsUrl = (link.metadata?.url as string) ?? link.url;
                const emoji = getSnsEmoji(platform);
                const commonClass =
                  "group flex w-full items-center justify-between rounded-2xl border border-border bg-card px-6 py-4 text-left font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:shadow-lg hover:shadow-primary/10";
                return (
                  <a
                    key={link.id}
                    href={snsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={commonClass}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{emoji}</span>
                      <span className="truncate">{link.title}</span>
                    </div>
                    <span className="text-primary opacity-60 transition-opacity group-hover:opacity-100 flex-shrink-0 ml-2">
                      ↗
                    </span>
                  </a>
                );
              }

              /* ── video ── */
              if (link.type === "video") {
                const videoUrl = (link.metadata?.video_url as string) ?? link.url;
                const caption = link.metadata?.caption as string | undefined;
                const videoId = extractYouTubeId(videoUrl);
                if (!videoId) return null;
                const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                return (
                  <div
                    key={link.id}
                    className="rounded-2xl overflow-hidden border border-border"
                  >
                    <div className="relative aspect-video w-full">
                      <iframe
                        src={embedUrl}
                        title={link.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 h-full w-full"
                      />
                    </div>
                    {caption && (
                      <p className="text-xs text-sub-text text-center py-2">
                        {caption}
                      </p>
                    )}
                  </div>
                );
              }

              /* ── music ── */
              if (link.type === "music") {
                const musicUrl = (link.metadata?.music_url as string) ?? link.url;
                const caption = link.metadata?.caption as string | undefined;
                const isSoundCloud = isSoundCloudUrl(musicUrl);
                const youtubeId = !isSoundCloud ? extractYouTubeId(musicUrl) : null;

                return (
                  <div
                    key={link.id}
                    className="rounded-2xl overflow-hidden border border-border"
                  >
                    {isSoundCloud ? (
                      <iframe
                        width="100%"
                        height="166"
                        allow="autoplay"
                        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
                          musicUrl
                        )}&color=%239999ff&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false`}
                        title={link.title}
                        className="w-full"
                      />
                    ) : youtubeId ? (
                      <iframe
                        width="100%"
                        height="80"
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        title={link.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full"
                      />
                    ) : null}
                    {caption && (
                      <p className="text-xs text-sub-text text-center py-2">
                        {caption}
                      </p>
                    )}
                  </div>
                );
              }

              /* ── link (기본) ── */
              const isExternal =
                link.url.startsWith("http://") ||
                link.url.startsWith("https://");
              const thumbnailUrl = link.metadata?.thumbnail_url as string | undefined;

              const commonClass =
                "group flex w-full items-center justify-between rounded-2xl border border-border bg-card px-6 py-4 text-left font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:shadow-lg hover:shadow-primary/10";

              const inner = (
                <>
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

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";

/* ── 콘텐츠 타입 정의 ── */
type ContentType = "link" | "text" | "spacer";
type SpacerSize = "small" | "medium" | "large";

interface MainLink {
  id: string;
  title: string;
  url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  type: string;
  metadata: Record<string, unknown>;
}

/* ── 타입 선택 모달에서 보여줄 타입 목록 ── */
const CONTENT_TYPES: {
  emoji: string;
  label: string;
  type: string;
  supported: boolean;
}[] = [
  { emoji: "🔗", label: "단일 링크", type: "link", supported: true },
  { emoji: "🔗🔗", label: "그룹 링크", type: "group", supported: false },
  { emoji: "📸", label: "SNS 연결", type: "sns", supported: false },
  { emoji: "▶️", label: "동영상", type: "video", supported: false },
  { emoji: "🅣", label: "텍스트", type: "text", supported: true },
  { emoji: "🖼️", label: "갤러리", type: "gallery", supported: false },
  { emoji: "⬜", label: "여백", type: "spacer", supported: true },
  { emoji: "🎵", label: "음악", type: "music", supported: false },
  { emoji: "📍", label: "지도", type: "map", supported: false },
  { emoji: "📎", label: "파일공유", type: "file", supported: false },
];

export default function AdminLinksPage() {
  const [links, setLinks] = useState<MainLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ── 타입 선택 모달 ── */
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);

  /* ── 추가 폼 공통 ── */
  const [adding, setAdding] = useState(false);

  /* ── link 타입 폼 ── */
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [fetchingThumb, setFetchingThumb] = useState(false);

  /* ── text 타입 폼 ── */
  const [newTextContent, setNewTextContent] = useState("");

  /* ── spacer 타입 폼 ── */
  const [spacerSize, setSpacerSize] = useState<SpacerSize>("medium");

  /* ── 인라인 수정 ── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editTextContent, setEditTextContent] = useState("");
  const [editSpacerSize, setEditSpacerSize] = useState<SpacerSize>("medium");
  const [editThumbnail, setEditThumbnail] = useState<string | null>(null);
  const [fetchingEditThumb, setFetchingEditThumb] = useState(false);

  const urlInputRef = useRef<HTMLInputElement>(null);

  const fetchLinks = useCallback(async () => {
    const res = await fetch("/api/admin/links");
    const data = await res.json();
    setLinks(data.links ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  /* ── 폼 초기화 ── */
  const resetForm = () => {
    setSelectedType(null);
    setNewTitle("");
    setNewUrl("");
    setThumbnail(null);
    setNewTextContent("");
    setSpacerSize("medium");
  };

  /* ── OG 이미지 자동 가져오기 (추가 폼) ── */
  const fetchThumbnail = async (url: string) => {
    if (!url.startsWith("http")) return;
    setFetchingThumb(true);
    try {
      const res = await fetch(
        `/api/og-fetch?url=${encodeURIComponent(url)}`
      );
      const data = await res.json();
      setThumbnail(data.imageUrl ?? null);
    } catch {
      setThumbnail(null);
    } finally {
      setFetchingThumb(false);
    }
  };

  /* ── OG 이미지 자동 가져오기 (수정 폼) ── */
  const fetchEditThumbnail = async (url: string) => {
    if (!url.startsWith("http")) return;
    setFetchingEditThumb(true);
    try {
      const res = await fetch(
        `/api/og-fetch?url=${encodeURIComponent(url)}`
      );
      const data = await res.json();
      setEditThumbnail(data.imageUrl ?? null);
    } catch {
      setEditThumbnail(null);
    } finally {
      setFetchingEditThumb(false);
    }
  };

  /* ── 순서 변경 ── */
  const moveLink = async (index: number, dir: "up" | "down") => {
    const next = [...links];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;

    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];

    const reordered = next.map((l, i) => ({ ...l, sort_order: i + 1 }));
    setLinks(reordered);

    await fetch("/api/admin/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: reordered.map((l) => ({ id: l.id, sort_order: l.sort_order })),
      }),
    });
  };

  /* ── 활성/비활성 토글 ── */
  const toggleActive = async (link: MainLink) => {
    setSaving(link.id);
    setLinks((prev) =>
      prev.map((l) =>
        l.id === link.id ? { ...l, is_active: !l.is_active } : l
      )
    );
    await fetch("/api/admin/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, is_active: !link.is_active }),
    });
    setSaving(null);
  };

  /* ── 인라인 수정 저장 ── */
  const saveEdit = async (link: MainLink) => {
    const id = link.id;
    setSaving(id);

    let body: Record<string, unknown> = { id };

    if (link.type === "text") {
      if (!editTextContent.trim()) { setSaving(null); return; }
      body = {
        id,
        title: editTextContent.slice(0, 20),
        url: "",
        metadata: { content: editTextContent },
      };
    } else if (link.type === "spacer") {
      body = {
        id,
        title: "spacer",
        url: "",
        metadata: { size: editSpacerSize },
      };
    } else {
      // link 타입
      if (!editTitle.trim() || !editUrl.trim()) { setSaving(null); return; }
      body = {
        id,
        title: editTitle,
        url: editUrl,
        metadata: { thumbnail_url: editThumbnail ?? undefined },
      };
    }

    const res = await fetch("/api/admin/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "수정 실패");
      setSaving(null);
      return;
    }

    // 로컬 상태 업데이트
    setLinks((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (link.type === "text") {
          return { ...l, title: editTextContent.slice(0, 20), metadata: { content: editTextContent } };
        } else if (link.type === "spacer") {
          return { ...l, metadata: { size: editSpacerSize } };
        } else {
          return { ...l, title: editTitle, url: editUrl, metadata: { thumbnail_url: editThumbnail ?? undefined } };
        }
      })
    );
    setEditingId(null);
    setSaving(null);
  };

  /* ── 삭제 ── */
  const deleteLink = async (id: string) => {
    if (!window.confirm("이 항목을 삭제하시겠습니까?")) return;
    setDeleting(id);
    await fetch("/api/admin/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setDeleting(null);
  };

  /* ── 콘텐츠 추가 ── */
  const addContent = async () => {
    if (!selectedType) return;
    setAdding(true);

    let body: Record<string, unknown> = { type: selectedType };

    if (selectedType === "link") {
      if (!newTitle.trim() || !newUrl.trim()) { setAdding(false); return; }
      body = {
        type: "link",
        title: newTitle.trim(),
        url: newUrl.trim(),
        metadata: thumbnail ? { thumbnail_url: thumbnail } : {},
      };
    } else if (selectedType === "text") {
      if (!newTextContent.trim()) { setAdding(false); return; }
      body = {
        type: "text",
        title: newTextContent.slice(0, 20),
        url: "",
        metadata: { content: newTextContent.trim() },
      };
    } else if (selectedType === "spacer") {
      body = {
        type: "spacer",
        title: "spacer",
        url: "",
        metadata: { size: spacerSize },
      };
    }

    const res = await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // 작업 1 버그 수정: res.ok 체크 후 에러 알림
    if (!res.ok) {
      alert(data.error || "추가 실패");
      setAdding(false);
      return;
    }

    if (data.link) {
      setLinks((prev) => [...prev, data.link]);
    }

    resetForm();
    setAdding(false);
  };

  /* ── 수정 모드 진입 시 초기값 세팅 ── */
  const startEdit = (link: MainLink) => {
    setEditingId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditTextContent((link.metadata?.content as string) ?? "");
    setEditSpacerSize(((link.metadata?.size as SpacerSize) ?? "medium"));
    setEditThumbnail((link.metadata?.thumbnail_url as string) ?? null);
  };

  /* ── 타입별 라벨 ── */
  const getTypeLabel = (type: string) => {
    const found = CONTENT_TYPES.find((t) => t.type === type);
    return found ? `${found.emoji} ${found.label}` : type;
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
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              🔗 메인 링크 <span className="text-primary">관리</span>
            </h1>
            <p className="mt-1 text-sm text-sub-text">
              메인 페이지에 노출될 콘텐츠를 추가·수정·순서 변경할 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowTypeModal(true); }}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110"
          >
            + 콘텐츠 추가
          </button>
        </div>

        {/* ── 타입 선택 모달 ── */}
        {showTypeModal && !selectedType && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-primary">콘텐츠 유형 선택</h2>
              <button
                onClick={() => setShowTypeModal(false)}
                className="text-sub-text hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.type}
                  onClick={() => {
                    if (!ct.supported) return;
                    setSelectedType(ct.type as ContentType);
                  }}
                  disabled={!ct.supported}
                  className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    ct.supported
                      ? "border-border hover:border-primary/60 hover:bg-background cursor-pointer"
                      : "border-border/30 opacity-40 cursor-not-allowed"
                  }`}
                >
                  <span className="text-2xl">{ct.emoji}</span>
                  <span className="text-xs text-sub-text leading-tight">{ct.label}</span>
                  {!ct.supported && (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-border px-1.5 py-0.5 text-[9px] text-sub-text">
                      준비중
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── link 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "link" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">🔗 단일 링크 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            <input
              type="text"
              placeholder="버튼 이름 (예: 인스타그램)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
            />
            {/* URL 입력 — blur 시 OG 썸네일 자동 가져오기 */}
            <input
              ref={urlInputRef}
              type="text"
              placeholder="URL (예: https://instagram.com/...)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onBlur={(e) => fetchThumbnail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
            />
            {/* 썸네일 미리보기 */}
            {(fetchingThumb || thumbnail) && (
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border bg-background flex-shrink-0 flex items-center justify-center">
                  {fetchingThumb ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : thumbnail ? (
                    <Image src={thumbnail} alt="썸네일" fill className="object-cover" unoptimized />
                  ) : null}
                </div>
                <span className="text-xs text-sub-text">
                  {fetchingThumb ? "썸네일 가져오는 중..." : "썸네일 미리보기"}
                </span>
                {thumbnail && !fetchingThumb && (
                  <button
                    onClick={() => setThumbnail(null)}
                    className="text-xs text-sub-text hover:text-red-400 transition-colors"
                  >
                    제거
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || !newTitle.trim() || !newUrl.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── text 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "text" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">🅣 텍스트 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            <textarea
              placeholder="표시할 텍스트 내용을 입력하세요"
              value={newTextContent}
              onChange={(e) => setNewTextContent(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || !newTextContent.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── spacer 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "spacer" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">⬜ 여백 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as SpacerSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setSpacerSize(size)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-all ${
                    spacerSize === size
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-sub-text hover:text-white"
                  }`}
                >
                  {size === "small" ? "작게" : size === "medium" ? "보통" : "크게"}
                </button>
              ))}
            </div>
            {/* 여백 크기 미리보기 */}
            <div className="rounded-lg border border-border/50 bg-background p-2 flex flex-col items-center">
              <div className="w-full bg-border/20 rounded" style={{ height: spacerSize === "small" ? 16 : spacerSize === "medium" ? 32 : 64 }} />
              <span className="mt-1 text-[10px] text-sub-text/50">{spacerSize === "small" ? "16px" : spacerSize === "medium" ? "32px" : "64px"}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "즉시 추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── 링크 목록 ── */}
        <div className="mt-6 space-y-3">
          {links.length === 0 && (
            <div className="rounded-xl border border-border bg-card py-12 text-center text-sub-text">
              등록된 콘텐츠가 없습니다.
            </div>
          )}

          {links.map((link, index) => (
            <div
              key={link.id}
              className={`rounded-xl border bg-card transition-all ${
                link.is_active ? "border-border" : "border-border/40 opacity-50"
              }`}
            >
              {editingId === link.id ? (
                /* ── 수정 모드 ── */
                <div className="p-4 space-y-2">
                  {link.type === "text" ? (
                    <textarea
                      value={editTextContent}
                      onChange={(e) => setEditTextContent(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none resize-none"
                      placeholder="텍스트 내용"
                    />
                  ) : link.type === "spacer" ? (
                    <div className="flex gap-2">
                      {(["small", "medium", "large"] as SpacerSize[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => setEditSpacerSize(size)}
                          className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-all ${
                            editSpacerSize === size
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border text-sub-text hover:text-white"
                          }`}
                        >
                          {size === "small" ? "작게" : size === "medium" ? "보통" : "크게"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="버튼 이름"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        onBlur={(e) => fetchEditThumbnail(e.target.value)}
                        placeholder="URL"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      {/* 수정 시 썸네일 미리보기 */}
                      {(fetchingEditThumb || editThumbnail) && (
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border bg-background flex-shrink-0 flex items-center justify-center">
                            {fetchingEditThumb ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            ) : editThumbnail ? (
                              <Image src={editThumbnail} alt="썸네일" fill className="object-cover" unoptimized />
                            ) : null}
                          </div>
                          <span className="text-xs text-sub-text">
                            {fetchingEditThumb ? "썸네일 가져오는 중..." : "썸네일 미리보기"}
                          </span>
                          {editThumbnail && !fetchingEditThumb && (
                            <button
                              onClick={() => setEditThumbnail(null)}
                              className="text-xs text-sub-text hover:text-red-400 transition-colors"
                            >
                              제거
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(link)}
                      disabled={saving === link.id}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background hover:brightness-110 disabled:opacity-50"
                    >
                      {saving === link.id ? "저장 중..." : "저장"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-border px-4 py-1.5 text-xs text-sub-text hover:text-white transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 일반 모드 ── */
                <div className="flex items-center gap-3 p-4">
                  {/* 순서 화살표 */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveLink(index, "up")}
                      disabled={index === 0}
                      className="flex h-6 w-6 items-center justify-center rounded text-sub-text hover:text-white transition-colors disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveLink(index, "down")}
                      disabled={index === links.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded text-sub-text hover:text-white transition-colors disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    {/* 타입 뱃지 */}
                    <p className="text-[10px] text-sub-text/60 mb-0.5">
                      {getTypeLabel(link.type)}
                    </p>
                    {link.type === "spacer" ? (
                      <p className="text-sm text-sub-text">
                        여백 — {(link.metadata?.size as string) ?? "medium"}
                      </p>
                    ) : link.type === "text" ? (
                      <p className="truncate text-sm text-sub-text">
                        {(link.metadata?.content as string)?.slice(0, 40) ?? link.title}
                      </p>
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold text-white">
                          {link.title}
                        </p>
                        <p className="truncate text-xs text-sub-text mt-0.5">
                          {link.url}
                        </p>
                      </>
                    )}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 활성/비활성 토글 */}
                    <button
                      onClick={() => toggleActive(link)}
                      disabled={saving === link.id}
                      title={link.is_active ? "비활성화" : "활성화"}
                      className={`h-8 w-14 rounded-full transition-all duration-200 ${
                        link.is_active ? "bg-primary" : "bg-border"
                      }`}
                    >
                      <div
                        className={`mx-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform duration-200 ${
                          link.is_active ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* 수정 */}
                    <button
                      onClick={() => startEdit(link)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      수정
                    </button>

                    {/* 삭제 */}
                    <button
                      onClick={() => deleteLink(link.id)}
                      disabled={deleting === link.id}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deleting === link.id ? "..." : "삭제"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 미리보기 안내 */}
        {links.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card/50 p-4 text-center">
            <p className="text-xs text-sub-text">
              활성화된 콘텐츠가 메인 페이지(
              <a href="/" target="_blank" className="text-primary hover:underline">
                /
              </a>
              )에 바로 반영됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

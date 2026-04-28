"use client";

import { useEffect, useState, useCallback } from "react";

interface MainLink {
  id: string;
  title: string;
  url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminLinksPage() {
  const [links, setLinks] = useState<MainLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);

  // 인라인 수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const fetchLinks = useCallback(async () => {
    const res = await fetch("/api/admin/links");
    const data = await res.json();
    setLinks(data.links ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

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
  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !editUrl.trim()) return;
    setSaving(id);
    await fetch("/api/admin/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editTitle, url: editUrl }),
    });
    setLinks((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, title: editTitle, url: editUrl } : l
      )
    );
    setEditingId(null);
    setSaving(null);
  };

  /* ── 삭제 ── */
  const deleteLink = async (id: string) => {
    if (!window.confirm("이 링크를 삭제하시겠습니까?")) return;
    setDeleting(id);
    await fetch("/api/admin/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setDeleting(null);
  };

  /* ── 추가 ── */
  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    setAdding(true);
    const res = await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, url: newUrl }),
    });
    const data = await res.json();
    if (data.link) {
      setLinks((prev) => [...prev, data.link]);
    }
    setNewTitle("");
    setNewUrl("");
    setShowAddForm(false);
    setAdding(false);
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
              메인 페이지에 노출될 버튼을 추가·수정·순서 변경할 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110"
          >
            + 링크 추가
          </button>
        </div>

        {/* 추가 폼 */}
        {showAddForm && (
          <form
            onSubmit={addLink}
            className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-primary">새 링크 추가</h2>
            <input
              type="text"
              placeholder="버튼 이름 (예: 인스타그램)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              placeholder="URL (예: https://instagram.com/...  또는  /shop)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding || !newTitle.trim() || !newUrl.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewTitle(""); setNewUrl(""); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {/* 링크 목록 */}
        <div className="mt-6 space-y-3">
          {links.length === 0 && (
            <div className="rounded-xl border border-border bg-card py-12 text-center text-sub-text">
              등록된 링크가 없습니다.
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
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(link.id)}
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
                    <p className="truncate text-sm font-semibold text-white">
                      {link.title}
                    </p>
                    <p className="truncate text-xs text-sub-text mt-0.5">
                      {link.url}
                    </p>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 활성/비활성 토글 */}
                    <button
                      onClick={() => toggleActive(link)}
                      disabled={saving === link.id}
                      title={link.is_active ? "비활성화" : "활성화"}
                      className={`h-8 w-14 rounded-full transition-all duration-200 ${
                        link.is_active
                          ? "bg-primary"
                          : "bg-border"
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
                      onClick={() => {
                        setEditingId(link.id);
                        setEditTitle(link.title);
                        setEditUrl(link.url);
                      }}
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
              활성화된 링크가 메인 페이지(
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

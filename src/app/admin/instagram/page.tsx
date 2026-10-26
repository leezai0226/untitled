"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/* ═══════════════ 타입 ═══════════════ */

interface IgAccount {
  id: string;
  ig_user_id: string;
  username: string;
  token_expires_at: string;
  is_active: boolean;
  connected_at: string;
}

interface DmRule {
  id: string;
  account_id: string;
  name: string;
  media_id: string | null;
  media_thumbnail_url: string | null;
  media_caption: string | null;
  keywords: string[];
  dm_text: string;
  card_title: string | null;
  card_subtitle: string | null;
  button_label: string | null;
  button_url: string | null;
  is_active: boolean;
  sent_count: number;
}

interface DmLog {
  id: string;
  commenter_username: string | null;
  comment_text: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

interface MediaItem {
  id: string;
  caption: string;
  media_type: string;
  thumbnail: string | null;
  permalink: string | null;
  timestamp: string | null;
}

const emptyForm = {
  name: "",
  media: null as MediaItem | null, // null = 전체 게시물
  keywords: [] as string[],
  useButton: true,
  dm_text: "",
  card_title: "",
  card_subtitle: "",
  button_label: "",
  button_url: "",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ═══════════════ 페이지 ═══════════════ */

function InstagramAdminInner() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [rules, setRules] = useState<DmRule[]>([]);
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [envReady, setEnvReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 빌더(에디터) 상태
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [keywordInput, setKeywordInput] = useState("");

  // 게시물 목록
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/instagram");
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts ?? []);
        setRules(data.rules ?? []);
        setLogs(data.logs ?? []);
        setEnvReady(data.envReady);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const error = searchParams.get("error");
    const connected = searchParams.get("connected");
    if (error) alert(`인스타그램 연결 실패:\n${error}`);
    if (connected) alert("✓ 인스타그램 계정이 연결되었습니다!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const account = accounts[0] ?? null;

  /* ── 게시물 로드 (빌더 열 때 1회) ── */
  const loadMedia = useCallback(async () => {
    if (media.length > 0 || mediaLoading) return;
    setMediaLoading(true);
    setMediaError(null);
    try {
      const res = await fetch("/api/admin/instagram/media");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMedia(data.media ?? []);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "게시물 조회 실패");
    } finally {
      setMediaLoading(false);
    }
  }, [media.length, mediaLoading]);

  /* ── 빌더 열기 ── */
  const openBuilder = (rule?: DmRule) => {
    if (!account) return alert("먼저 인스타그램 계정을 연결해 주세요.");
    if (rule) {
      setEditingId(rule.id);
      setForm({
        name: rule.name,
        media: rule.media_id
          ? {
              id: rule.media_id,
              caption: rule.media_caption ?? "",
              media_type: "IMAGE",
              thumbnail: rule.media_thumbnail_url,
              permalink: null,
              timestamp: null,
            }
          : null,
        keywords: rule.keywords,
        useButton: !!rule.button_label,
        dm_text: rule.dm_text,
        card_title: rule.card_title ?? "",
        card_subtitle: rule.card_subtitle ?? "",
        button_label: rule.button_label ?? "",
        button_url: rule.button_url ?? "",
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyForm });
    }
    setKeywordInput("");
    setBuilderOpen(true);
    loadMedia();
  };

  /* ── 키워드 칩 ── */
  const addKeyword = () => {
    const parts = keywordInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setForm((p) => ({
      ...p,
      keywords: Array.from(new Set([...p.keywords, ...parts])),
    }));
    setKeywordInput("");
  };

  const removeKeyword = (k: string) => {
    setForm((p) => ({ ...p, keywords: p.keywords.filter((x) => x !== k) }));
  };

  /* ── 저장 ── */
  const submitRule = async () => {
    if (!account) return;
    if (!form.name.trim()) return alert("자동화 이름을 입력해 주세요.");
    if (form.keywords.length === 0)
      return alert("키워드를 1개 이상 추가해 주세요. (입력 후 Enter)");
    if (
      form.useButton &&
      (!form.card_title.trim() || !form.button_label.trim() || !form.button_url.trim())
    ) {
      return alert("버튼 DM은 카드 제목·버튼 문구·링크가 모두 필요합니다.");
    }
    if (!form.useButton && !form.dm_text.trim()) {
      return alert("DM 내용을 입력해 주세요.");
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      account_id: account.id,
      name: form.name,
      keywords: form.keywords,
      media_id: form.media?.id ?? "",
      media_thumbnail_url: form.media?.thumbnail ?? "",
      media_caption: form.media?.caption ?? "",
      dm_text: form.dm_text,
      card_title: form.useButton ? form.card_title : "",
      card_subtitle: form.useButton ? form.card_subtitle : "",
      button_label: form.useButton ? form.button_label : "",
      button_url: form.useButton ? form.button_url : "",
    };

    const res = await fetch("/api/admin/instagram", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return alert(data.error || "저장 실패");
    setBuilderOpen(false);
    fetchAll();
  };

  const toggleRule = async (rule: DmRule) => {
    await fetch("/api/admin/instagram", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
    fetchAll();
  };

  const deleteRule = async (rule: DmRule) => {
    if (!confirm(`"${rule.name}" 자동화를 삭제할까요?`)) return;
    await fetch("/api/admin/instagram", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "rule", id: rule.id }),
    });
    fetchAll();
  };

  const disconnectAccount = async () => {
    if (!account) return;
    if (!confirm(`@${account.username} 연결을 해제할까요?\n자동화와 로그도 함께 삭제됩니다.`)) return;
    await fetch("/api/admin/instagram", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "account", id: account.id }),
    });
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <p className="text-sub-text">불러오는 중...</p>
      </div>
    );
  }

  /* ═══════════════ 렌더링 ═══════════════ */

  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              📩 인스타그램 <span className="text-primary">자동 DM</span>
            </h1>
            <p className="mt-2 text-sm text-sub-text">
              댓글 키워드에 반응해 자동으로 DM을 보냅니다.
            </p>
          </div>
          <button
            onClick={() => openBuilder()}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-background transition-all hover:brightness-110"
          >
            + 새 자동화 만들기
          </button>
        </div>

        {!envReady && (
          <div className="mt-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-sm text-yellow-300">
            ⚠️ 인스타그램 환경변수가 설정되지 않았습니다.
          </div>
        )}

        {/* ── 계정 ── */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-6 py-4">
          {account ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-lg">
                  📷
                </div>
                <div>
                  <p className="font-semibold text-white">@{account.username}</p>
                  <p className="text-xs text-sub-text">
                    연결됨 · 토큰 자동 갱신 중
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href="/api/instagram/oauth/start"
                  className="rounded-lg border border-border px-4 py-2 text-xs text-sub-text hover:border-primary/50 hover:text-white"
                >
                  재연결
                </a>
                <button
                  onClick={disconnectAccount}
                  className="rounded-lg border border-border px-4 py-2 text-xs text-sub-text hover:border-red-400/50 hover:text-red-400"
                >
                  연결 해제
                </button>
              </div>
            </>
          ) : (
            <div className="w-full text-center py-4">
              <a
                href="/api/instagram/oauth/start"
                className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-background hover:brightness-110"
              >
                인스타그램 계정 연결하기
              </a>
            </div>
          )}
        </div>

        {/* ── 자동화 목록 ── */}
        <div className="mt-8 space-y-3">
          {rules.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
              <p className="text-4xl mb-4">⚡️</p>
              <p className="text-white font-semibold">아직 자동화가 없어요</p>
              <p className="mt-1 text-sm text-sub-text">
                &quot;새 자동화 만들기&quot;로 첫 댓글 자동 DM을 설정해 보세요.
              </p>
            </div>
          )}

          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              {/* 대상 게시물 썸네일 */}
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-background">
                {rule.media_id && rule.media_thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rule.media_thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-[10px] font-bold text-primary">
                    <span className="text-base">🗂</span>
                    전체
                  </div>
                )}
              </div>

              {/* 정보 */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white truncate">{rule.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rule.keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary"
                    >
                      💬 {k}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-sub-text">
                  {rule.button_label ? `🔗 버튼 DM · ${rule.button_label}` : "💬 텍스트 DM"} ·
                  발송 {rule.sent_count}회
                </p>
              </div>

              {/* 액션 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleRule(rule)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    rule.is_active ? "bg-primary" : "bg-border"
                  }`}
                  title={rule.is_active ? "작동 중" : "중지됨"}
                >
                  <span
                    className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      rule.is_active ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <button
                  onClick={() => openBuilder(rule)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:text-white"
                >
                  수정
                </button>
                <button
                  onClick={() => deleteRule(rule)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:text-red-400"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── 발송 로그 ── */}
        <div className="mt-10">
          <h2 className="text-lg font-bold text-white">최근 발송 로그</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            {logs.length === 0 ? (
              <p className="p-8 text-center text-sm text-sub-text">
                아직 발송 기록이 없습니다.
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-white">
                      @{log.commenter_username || "unknown"}
                      <span className="ml-2 text-xs text-sub-text">
                        &quot;{(log.comment_text || "").slice(0, 40)}&quot;
                      </span>
                    </p>
                    {log.error && (
                      <p className="mt-0.5 text-xs text-red-400 truncate">{log.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span
                      className={
                        log.status === "sent"
                          ? "text-green-400"
                          : log.status === "failed"
                            ? "text-red-400"
                            : "text-yellow-400"
                      }
                    >
                      {log.status === "sent" ? "✓ 발송" : log.status === "failed" ? "✗ 실패" : "대기"}
                    </span>
                    <span className="text-sub-text">{formatDate(log.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ 자동화 빌더 (모달) ═══════════════ */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-2xl border border-border bg-background shadow-2xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-bold text-white">
                {editingId ? "자동화 수정" : "새 자동화 만들기"}
              </h2>
              <button
                onClick={() => setBuilderOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sub-text hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_340px]">
              {/* ───── 왼쪽: 설정 단계 ───── */}
              <div className="space-y-8 p-6 lg:border-r lg:border-border">

                {/* 이름 */}
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="자동화 이름 (예: 프리셋 이벤트)"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base font-semibold text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                />

                {/* STEP 1 — 게시물 선택 */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">1</span>
                    <h3 className="font-bold text-white">어떤 게시물에 반응할까요?</h3>
                  </div>

                  {mediaLoading ? (
                    <p className="mt-4 text-sm text-sub-text">게시물 불러오는 중...</p>
                  ) : mediaError ? (
                    <p className="mt-4 text-sm text-red-400">{mediaError}</p>
                  ) : (
                    <div className="mt-4 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
                      {/* 전체 게시물 */}
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, media: null }))}
                        className={`flex aspect-square flex-col items-center justify-center rounded-xl border-2 text-xs font-bold transition-all ${
                          form.media === null
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-card text-sub-text hover:border-primary/50"
                        }`}
                      >
                        <span className="text-xl">🗂</span>
                        모든 게시물
                      </button>

                      {media.map((m) => {
                        const selected = form.media?.id === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, media: m }))}
                            className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                              selected
                                ? "border-primary ring-2 ring-primary/40"
                                : "border-border hover:border-primary/50"
                            }`}
                            title={m.caption}
                          >
                            {m.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.thumbnail}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-card text-xl">
                                {m.media_type === "VIDEO" ? "🎬" : "🖼"}
                              </div>
                            )}
                            {selected && (
                              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-background">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-sub-text/70">
                    {form.media
                      ? `선택됨: "${(form.media.caption || "캡션 없음").slice(0, 40)}"`
                      : "모든 게시물의 댓글에 반응합니다."}
                  </p>
                </div>

                {/* STEP 2 — 키워드 */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">2</span>
                    <h3 className="font-bold text-white">어떤 댓글에 반응할까요?</h3>
                  </div>
                  <div className="mt-4 rounded-xl border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {form.keywords.map((k) => (
                        <span
                          key={k}
                          className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5 text-sm font-semibold text-primary"
                        >
                          {k}
                          <button
                            type="button"
                            onClick={() => removeKeyword(k)}
                            className="text-primary/60 hover:text-primary"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                        onBlur={addKeyword}
                        placeholder={form.keywords.length === 0 ? "키워드 입력 후 Enter (예: 프리셋)" : "+ 추가"}
                        className="min-w-[140px] flex-1 bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-sub-text/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-sub-text/70">
                    댓글에 키워드 중 하나라도 포함되면 DM이 발송됩니다. (대소문자 무시)
                  </p>
                </div>

                {/* STEP 3 — DM 구성 */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">3</span>
                    <h3 className="font-bold text-white">어떤 DM을 보낼까요?</h3>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { v: true, label: "🔗 링크 버튼 DM", desc: "카드 + 버튼" },
                      { v: false, label: "💬 텍스트 DM", desc: "일반 메시지" },
                    ].map((opt) => (
                      <label
                        key={String(opt.v)}
                        className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${
                          form.useButton === opt.v
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          checked={form.useButton === opt.v}
                          onChange={() => setForm((p) => ({ ...p, useButton: opt.v }))}
                          className="sr-only"
                        />
                        <p className="text-sm font-semibold text-white">{opt.label}</p>
                        <p className="mt-0.5 text-[11px] text-sub-text">{opt.desc}</p>
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 space-y-3">
                    {form.useButton ? (
                      <>
                        <input
                          type="text"
                          maxLength={80}
                          value={form.card_title}
                          onChange={(e) => setForm((p) => ({ ...p, card_title: e.target.value }))}
                          placeholder="카드 제목 * (예: 요청하신 링크예요! 🎁)"
                          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                        />
                        <input
                          type="text"
                          maxLength={80}
                          value={form.card_subtitle}
                          onChange={(e) => setForm((p) => ({ ...p, card_subtitle: e.target.value }))}
                          placeholder="카드 설명 (선택)"
                          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={20}
                            value={form.button_label}
                            onChange={(e) => setForm((p) => ({ ...p, button_label: e.target.value }))}
                            placeholder="버튼 문구 *"
                            className="w-36 rounded-xl border border-border bg-card px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                          />
                          <input
                            type="url"
                            value={form.button_url}
                            onChange={(e) => setForm((p) => ({ ...p, button_url: e.target.value }))}
                            placeholder="버튼 링크 URL *"
                            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                          />
                        </div>
                      </>
                    ) : (
                      <textarea
                        value={form.dm_text}
                        onChange={(e) => setForm((p) => ({ ...p, dm_text: e.target.value }))}
                        placeholder="DM 내용 *"
                        rows={4}
                        className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ───── 오른쪽: DM 미리보기 ───── */}
              <div className="flex flex-col items-center justify-start bg-card/40 p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-sub-text">
                  DM 미리보기
                </p>

                {/* 폰 프레임 */}
                <div className="w-full max-w-[280px] rounded-[2rem] border-4 border-border bg-background p-4 shadow-xl">
                  {/* 상대 프로필 */}
                  <div className="mb-4 flex items-center gap-2 border-b border-border/50 pb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-sm">
                      📷
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {account ? account.username : "my_account"}
                      </p>
                      <p className="text-[10px] text-sub-text">Instagram</p>
                    </div>
                  </div>

                  {/* 받은 댓글 (시뮬레이션) */}
                  <div className="mb-3 flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary/20 px-3 py-2">
                      <p className="text-xs text-white">
                        {form.keywords[0] || "키워드"}
                      </p>
                    </div>
                  </div>

                  {/* 자동 DM */}
                  <div className="flex justify-start">
                    {form.useButton ? (
                      <div className="w-[85%] overflow-hidden rounded-2xl rounded-bl-md border border-border bg-card">
                        <div className="px-3 py-3">
                          <p className="text-xs font-bold text-white break-words">
                            {form.card_title || "카드 제목"}
                          </p>
                          {form.card_subtitle && (
                            <p className="mt-1 text-[11px] text-sub-text break-words">
                              {form.card_subtitle}
                            </p>
                          )}
                        </div>
                        <div className="border-t border-border bg-background/50 px-3 py-2.5 text-center">
                          <p className="text-xs font-semibold text-primary">
                            {form.button_label || "버튼 문구"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2">
                        <p className="text-xs text-white whitespace-pre-wrap break-words">
                          {form.dm_text || "DM 내용이 여기에 표시됩니다"}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-center text-[9px] text-sub-text/50">
                    댓글 작성자에게 자동 발송됩니다
                  </p>
                </div>

                {/* 저장 버튼 */}
                <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2">
                  <button
                    onClick={submitRule}
                    disabled={saving}
                    className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-background hover:brightness-110 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : editingId ? "수정 저장" : "자동화 시작하기"}
                  </button>
                  <button
                    onClick={() => setBuilderOpen(false)}
                    className="w-full rounded-xl border border-border py-3 text-sm text-sub-text hover:text-white"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InstagramAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center pt-20">
          <p className="text-sub-text">불러오는 중...</p>
        </div>
      }
    >
      <InstagramAdminInner />
    </Suspense>
  );
}

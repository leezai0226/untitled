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
  button_label: string | null;
  button_url: string | null;
  button2_label: string | null;
  button2_url: string | null;
  reply_enabled: boolean;
  reply_text: string | null;
  follower_only: boolean;
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
  media: null as MediaItem | null,
  keywords: [] as string[],
  dm_text: "",
  button_label: "",
  button_url: "",
  button2_label: "",
  button2_url: "",
  showButton2: false,
  reply_enabled: false,
  reply_text: "",
  follower_only: false,
};

type FormState = typeof emptyForm;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ── 아코디언 섹션 ── */
function Step({
  no,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  no: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              open ? "bg-primary text-background" : "bg-border text-sub-text"
            }`}
          >
            {no}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-white">{title}</p>
            {!open && (
              <p className="mt-0.5 truncate text-xs text-sub-text">{summary}</p>
            )}
          </div>
        </div>
        <span
          className={`flex-shrink-0 text-sub-text transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && <div className="border-t border-border/60 px-5 py-5">{children}</div>}
    </div>
  );
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

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [keywordInput, setKeywordInput] = useState("");
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
  });

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

  const toggleStep = (n: number) =>
    setOpenSteps((p) => ({ ...p, [n]: !p[n] }));

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
        dm_text: rule.dm_text,
        button_label: rule.button_label ?? "",
        button_url: rule.button_url ?? "",
        button2_label: rule.button2_label ?? "",
        button2_url: rule.button2_url ?? "",
        showButton2: !!rule.button2_label,
        reply_enabled: rule.reply_enabled,
        reply_text: rule.reply_text ?? "",
        follower_only: rule.follower_only,
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyForm });
    }
    setKeywordInput("");
    setOpenSteps({ 1: true, 2: false, 3: false, 4: false });
    setBuilderOpen(true);
    loadMedia();
  };

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

  const removeKeyword = (k: string) =>
    setForm((p) => ({ ...p, keywords: p.keywords.filter((x) => x !== k) }));

  const submitRule = async () => {
    if (!account) return;
    if (!form.name.trim()) return alert("자동화 이름을 입력해 주세요.");
    if (form.keywords.length === 0)
      return alert("키워드를 1개 이상 추가해 주세요. (입력 후 Enter)");
    if (!form.dm_text.trim()) return alert("DM 내용을 입력해 주세요.");
    if (
      (form.button_label.trim() || form.button_url.trim()) &&
      !(form.button_label.trim() && form.button_url.trim())
    ) {
      return alert("버튼 1의 문구와 링크를 모두 입력해 주세요.");
    }
    if (
      form.showButton2 &&
      (form.button2_label.trim() || form.button2_url.trim()) &&
      !(form.button2_label.trim() && form.button2_url.trim())
    ) {
      return alert("버튼 2의 문구와 링크를 모두 입력해 주세요.");
    }
    if (form.reply_enabled && !form.reply_text.trim()) {
      return alert("자동 댓글 내용을 입력해 주세요.");
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
      button_label: form.button_label,
      button_url: form.button_url,
      button2_label: form.showButton2 ? form.button2_label : "",
      button2_url: form.showButton2 ? form.button2_url : "",
      reply_enabled: form.reply_enabled,
      reply_text: form.reply_text,
      follower_only: form.follower_only,
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

  const previewButtons = [
    form.button_label && { label: form.button_label },
    form.showButton2 && form.button2_label && { label: form.button2_label },
  ].filter(Boolean) as { label: string }[];

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
                  <p className="text-xs text-sub-text">연결됨 · 토큰 자동 갱신 중</p>
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
            <div className="w-full py-4 text-center">
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
              <p className="mb-4 text-4xl">⚡️</p>
              <p className="font-semibold text-white">아직 자동화가 없어요</p>
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
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-background">
                {rule.media_id && rule.media_thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={rule.media_thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-[10px] font-bold text-primary">
                    <span className="text-base">🗂</span>
                    전체
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{rule.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rule.keywords.map((k) => (
                    <span key={k} className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      💬 {k}
                    </span>
                  ))}
                  {rule.follower_only && (
                    <span className="rounded-md bg-pink-500/15 px-2 py-0.5 text-[11px] font-semibold text-pink-400">
                      팔로워만
                    </span>
                  )}
                  {rule.reply_enabled && (
                    <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-400">
                      자동댓글
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-sub-text">
                  {rule.button_label
                    ? `🔗 버튼 ${rule.button2_label ? "2개" : "1개"}`
                    : "💬 텍스트"} · 발송 {rule.sent_count}회
                </p>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  onClick={() => toggleRule(rule)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${rule.is_active ? "bg-primary" : "bg-border"}`}
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
              <p className="p-8 text-center text-sm text-sub-text">아직 발송 기록이 없습니다.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3 text-sm last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-white">
                      @{log.commenter_username || "unknown"}
                      <span className="ml-2 text-xs text-sub-text">
                        &quot;{(log.comment_text || "").slice(0, 40)}&quot;
                      </span>
                    </p>
                    {log.error && <p className="mt-0.5 truncate text-xs text-red-400">{log.error}</p>}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                    <span
                      className={
                        log.status === "sent"
                          ? "text-green-400"
                          : log.status === "failed"
                            ? "text-red-400"
                            : "text-yellow-400"
                      }
                    >
                      {log.status === "sent" ? "✓ 발송" : log.status === "failed" ? "✗ 실패" : "건너뜀"}
                    </span>
                    <span className="text-sub-text">{formatDate(log.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ 자동화 빌더 ═══════════════ */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-2xl border border-border bg-background shadow-2xl">
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
              {/* ───── 왼쪽: 설정 ───── */}
              <div className="space-y-4 p-6 lg:border-r lg:border-border">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="자동화 이름 (예: 프리셋 이벤트)"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base font-semibold text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                />

                {/* STEP 1 — 게시물 */}
                <Step
                  no="1"
                  title="어떤 게시물에 반응할까요?"
                  summary={
                    form.media
                      ? `선택됨 · ${(form.media.caption || "캡션 없음").slice(0, 30)}`
                      : "모든 게시물"
                  }
                  open={openSteps[1]}
                  onToggle={() => toggleStep(1)}
                >
                  {mediaLoading ? (
                    <p className="text-sm text-sub-text">게시물 불러오는 중...</p>
                  ) : mediaError ? (
                    <p className="text-sm text-red-400">{mediaError}</p>
                  ) : (
                    <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, media: null }))}
                        className={`flex aspect-square flex-col items-center justify-center rounded-xl border-2 text-xs font-bold transition-all ${
                          form.media === null
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background text-sub-text hover:border-primary/50"
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
                              selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                            }`}
                            title={m.caption}
                          >
                            {m.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.thumbnail} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-background text-xl">
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
                </Step>

                {/* STEP 2 — 키워드 + 대상 조건 */}
                <Step
                  no="2"
                  title="어떤 댓글에 반응할까요?"
                  summary={
                    form.keywords.length > 0
                      ? `키워드 ${form.keywords.length}개${form.follower_only ? " · 팔로워만" : ""}`
                      : "키워드 미설정"
                  }
                  open={openSteps[2]}
                  onToggle={() => toggleStep(2)}
                >
                  <div className="rounded-xl border border-border bg-background p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {form.keywords.map((k) => (
                        <span key={k} className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5 text-sm font-semibold text-primary">
                          {k}
                          <button type="button" onClick={() => removeKeyword(k)} className="text-primary/60 hover:text-primary">
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
                    댓글에 키워드 중 하나라도 포함되면 발동됩니다. (대소문자 무시)
                  </p>

                  {/* 팔로워 조건 */}
                  <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">팔로워에게만 DM 보내기</p>
                      <p className="mt-0.5 text-xs text-sub-text">
                        내 계정을 팔로우하지 않은 사람의 댓글은 건너뜁니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, follower_only: !p.follower_only }))}
                      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${form.follower_only ? "bg-primary" : "bg-border"}`}
                    >
                      <span
                        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          form.follower_only ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>
                </Step>

                {/* STEP 3 — DM 구성 */}
                <Step
                  no="3"
                  title="어떤 DM을 보낼까요?"
                  summary={
                    form.dm_text
                      ? `${form.dm_text.slice(0, 30)}${previewButtons.length ? ` · 버튼 ${previewButtons.length}개` : ""}`
                      : "DM 미작성"
                  }
                  open={openSteps[3]}
                  onToggle={() => toggleStep(3)}
                >
                  <textarea
                    value={form.dm_text}
                    onChange={(e) => setForm((p) => ({ ...p, dm_text: e.target.value }))}
                    placeholder={"DM 내용 * (줄바꿈 가능, 최대 640자)\n\n예)\n안녕하세요! 무제입니다 🙌\n요청하신 링크 보내드려요."}
                    rows={7}
                    maxLength={640}
                    className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-right text-[11px] text-sub-text/60">
                    {form.dm_text.length} / 640
                  </p>

                  {/* 버튼 1 */}
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-bold text-sub-text">🔗 링크 버튼 (선택, 최대 2개)</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={20}
                        value={form.button_label}
                        onChange={(e) => setForm((p) => ({ ...p, button_label: e.target.value }))}
                        placeholder="버튼 1 문구"
                        className="w-36 rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                      />
                      <input
                        type="url"
                        value={form.button_url}
                        onChange={(e) => setForm((p) => ({ ...p, button_url: e.target.value }))}
                        placeholder="버튼 1 링크 URL"
                        className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                      />
                    </div>

                    {/* 버튼 2 */}
                    {form.showButton2 ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={20}
                          value={form.button2_label}
                          onChange={(e) => setForm((p) => ({ ...p, button2_label: e.target.value }))}
                          placeholder="버튼 2 문구"
                          className="w-36 rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                        />
                        <input
                          type="url"
                          value={form.button2_url}
                          onChange={(e) => setForm((p) => ({ ...p, button2_url: e.target.value }))}
                          placeholder="버튼 2 링크 URL"
                          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({ ...p, showButton2: false, button2_label: "", button2_url: "" }))
                          }
                          className="flex-shrink-0 rounded-xl border border-border px-3 text-xs text-sub-text hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, showButton2: true }))}
                        className="rounded-xl bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20"
                      >
                        + 버튼 추가
                      </button>
                    )}
                  </div>
                </Step>

                {/* STEP 4 — 자동 댓글 */}
                <Step
                  no="4"
                  title="자동 댓글도 달까요?"
                  summary={form.reply_enabled ? `ON · "${form.reply_text.slice(0, 30)}"` : "사용 안 함"}
                  open={openSteps[4]}
                  onToggle={() => toggleStep(4)}
                >
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">댓글에 공개 답글 자동 작성</p>
                      <p className="mt-0.5 text-xs text-sub-text">
                        DM 발송에 성공하면 해당 댓글에 답글을 남깁니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, reply_enabled: !p.reply_enabled }))}
                      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${form.reply_enabled ? "bg-primary" : "bg-border"}`}
                    >
                      <span
                        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          form.reply_enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>

                  {form.reply_enabled && (
                    <input
                      type="text"
                      maxLength={300}
                      value={form.reply_text}
                      onChange={(e) => setForm((p) => ({ ...p, reply_text: e.target.value }))}
                      placeholder="답글 내용 (예: DM 보내드렸어요! 📩 확인해 주세요)"
                      className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                    />
                  )}
                </Step>
              </div>

              {/* ───── 오른쪽: 미리보기 ───── */}
              <div className="flex flex-col items-center justify-start bg-card/40 p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-sub-text">
                  DM 미리보기
                </p>

                <div className="w-full max-w-[280px] rounded-[2rem] border-4 border-border bg-background p-4 shadow-xl">
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

                  {/* 상대 댓글 */}
                  <div className="mb-1 flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary/20 px-3 py-2">
                      <p className="text-xs text-white">{form.keywords[0] || "키워드"}</p>
                    </div>
                  </div>

                  {/* 자동 공개 답글 */}
                  {form.reply_enabled && form.reply_text && (
                    <p className="mb-2 text-right text-[9px] text-sub-text/70">
                      ↳ 공개 답글: {form.reply_text.slice(0, 30)}
                    </p>
                  )}

                  {/* 자동 DM */}
                  <div className="mt-2 flex justify-start">
                    <div className="w-[88%] overflow-hidden rounded-2xl rounded-bl-md border border-border bg-card">
                      <div className="px-3 py-3">
                        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-white">
                          {form.dm_text || "DM 내용이 여기에 표시됩니다"}
                        </p>
                      </div>
                      {previewButtons.map((b, i) => (
                        <div
                          key={i}
                          className="border-t border-border bg-background/50 px-3 py-2.5 text-center"
                        >
                          <p className="text-xs font-semibold text-primary">{b.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-center text-[9px] text-sub-text/50">
                    {form.follower_only ? "팔로워의 " : ""}댓글 작성자에게 자동 발송됩니다
                  </p>
                </div>

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

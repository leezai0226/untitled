"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/* ─────────────── 타입 ─────────────── */

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

const emptyForm = {
  name: "",
  keywords: "",
  media_id: "",
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

function InstagramAdminInner() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [rules, setRules] = useState<DmRule[]>([]);
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [envReady, setEnvReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

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

  // OAuth 리다이렉트 결과 알림
  useEffect(() => {
    const error = searchParams.get("error");
    const connected = searchParams.get("connected");
    if (error) alert(`인스타그램 연결 실패:\n${error}`);
    if (connected) alert("✓ 인스타그램 계정이 연결되었습니다!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const account = accounts[0] ?? null;

  /* ── 규칙 저장 ── */
  const openForm = (rule?: DmRule) => {
    if (rule) {
      setEditingId(rule.id);
      setForm({
        name: rule.name,
        keywords: rule.keywords.join(", "),
        media_id: rule.media_id ?? "",
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
    setShowForm(true);
  };

  const submitRule = async () => {
    if (!account) return alert("먼저 인스타그램 계정을 연결해 주세요.");
    const keywords = form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!form.name.trim() || keywords.length === 0) {
      return alert("규칙 이름과 키워드를 입력해 주세요.");
    }
    if (form.useButton && (!form.card_title.trim() || !form.button_label.trim() || !form.button_url.trim())) {
      return alert("버튼 DM은 카드 제목, 버튼 문구, 링크가 모두 필요합니다.");
    }
    if (!form.useButton && !form.dm_text.trim()) {
      return alert("DM 내용을 입력해 주세요.");
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      account_id: account.id,
      name: form.name,
      keywords,
      media_id: form.media_id,
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
    setShowForm(false);
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
    if (!confirm(`"${rule.name}" 규칙을 삭제할까요?`)) return;
    await fetch("/api/admin/instagram", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "rule", id: rule.id }),
    });
    fetchAll();
  };

  const disconnectAccount = async () => {
    if (!account) return;
    if (!confirm(`@${account.username} 연결을 해제할까요?\n규칙과 로그도 함께 삭제됩니다.`)) return;
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

  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold text-white">
          📩 인스타그램 <span className="text-primary">자동 DM</span>
        </h1>
        <p className="mt-2 text-sm text-sub-text">
          게시물 댓글에 키워드가 달리면 자동으로 DM을 보냅니다. (댓글 1개당 1회)
        </p>

        {/* ── 환경변수 미설정 경고 ── */}
        {!envReady && (
          <div className="mt-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-sm text-yellow-300 leading-relaxed">
            ⚠️ Vercel 환경변수(INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET /
            INSTAGRAM_VERIFY_TOKEN)가 아직 설정되지 않았습니다. 설정 후 다시
            배포해야 연결이 작동합니다.
          </div>
        )}

        {/* ── 계정 연결 ── */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-white">계정 연결</h2>
          {account ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">@{account.username}</p>
                <p className="mt-1 text-xs text-sub-text">
                  토큰 만료:{" "}
                  {new Date(account.token_expires_at).toLocaleDateString("ko-KR")}{" "}
                  (자동 갱신됨)
                </p>
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
            </div>
          ) : (
            <div className="mt-4">
              <a
                href="/api/instagram/oauth/start"
                className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-background transition-all hover:brightness-110"
              >
                인스타그램 계정 연결하기
              </a>
              <p className="mt-3 text-xs text-sub-text">
                비즈니스/크리에이터 계정이어야 하며, Meta 앱에 테스터로 등록된
                계정만 연결됩니다.
              </p>
            </div>
          )}
        </div>

        {/* ── 자동 DM 규칙 ── */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">자동 DM 규칙</h2>
            <button
              onClick={() => openForm()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-background hover:brightness-110"
            >
              + 규칙 추가
            </button>
          </div>

          {/* 규칙 폼 */}
          {showForm && (
            <div className="mt-4 rounded-2xl border border-primary/40 bg-card p-6 space-y-4">
              <p className="text-sm font-bold text-primary">
                {editingId ? "규칙 수정" : "새 규칙"}
              </p>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="규칙 이름 (예: 프리셋 이벤트) *"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                value={form.keywords}
                onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))}
                placeholder="키워드 (쉼표로 구분, 예: 프리셋, 링크, 받기) *"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                value={form.media_id}
                onChange={(e) => setForm((p) => ({ ...p, media_id: e.target.value }))}
                placeholder="게시물 ID (비우면 모든 게시물에 적용)"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
              />

              {/* DM 형태 선택 */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: true, label: "🔗 링크 버튼 DM", desc: "제목+설명+버튼 카드" },
                  { v: false, label: "💬 텍스트 DM", desc: "일반 텍스트 메시지" },
                ].map((opt) => (
                  <label
                    key={String(opt.v)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
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
                    <p className="mt-1 text-xs text-sub-text">{opt.desc}</p>
                  </label>
                ))}
              </div>

              {form.useButton ? (
                <>
                  <input
                    type="text"
                    maxLength={80}
                    value={form.card_title}
                    onChange={(e) => setForm((p) => ({ ...p, card_title: e.target.value }))}
                    placeholder="카드 제목 (최대 80자) *"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    maxLength={80}
                    value={form.card_subtitle}
                    onChange={(e) => setForm((p) => ({ ...p, card_subtitle: e.target.value }))}
                    placeholder="카드 설명 (최대 80자, 선택)"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={20}
                      value={form.button_label}
                      onChange={(e) => setForm((p) => ({ ...p, button_label: e.target.value }))}
                      placeholder="버튼 문구 *"
                      className="w-40 rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                    />
                    <input
                      type="url"
                      value={form.button_url}
                      onChange={(e) => setForm((p) => ({ ...p, button_url: e.target.value }))}
                      placeholder="버튼 링크 URL *"
                      className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <textarea
                  value={form.dm_text}
                  onChange={(e) => setForm((p) => ({ ...p, dm_text: e.target.value }))}
                  placeholder="DM 내용 *"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none"
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={submitRule}
                  disabled={saving}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-background hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm text-sub-text hover:text-white"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 규칙 목록 */}
          <div className="mt-4 space-y-3">
            {rules.length === 0 && !showForm && (
              <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-sub-text">
                규칙이 없습니다. 계정 연결 후 &quot;+ 규칙 추가&quot;로 시작하세요.
              </p>
            )}
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {rule.name}
                    {rule.button_label && (
                      <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        🔗 {rule.button_label}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-sub-text truncate">
                    키워드: {rule.keywords.join(", ")} ·{" "}
                    {rule.media_id ? `게시물 ${rule.media_id.slice(0, 8)}…` : "모든 게시물"} ·
                    발송 {rule.sent_count}회
                  </p>
                </div>
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
                    onClick={() => openForm(rule)}
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

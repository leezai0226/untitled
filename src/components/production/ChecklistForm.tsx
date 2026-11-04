"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";
import { privacy } from "@/config/production";

/**
 * 체크리스트 다운로드 폼 — 리드는 신청 폼과 같은 leads 테이블에
 * type: "checklist" 로 저장된다.
 */

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors";

const labelClass = "block text-sm font-medium text-sub-text mb-2";

export default function ChecklistForm({ pdfReady }: { pdfReady: boolean }) {
  const [form, setForm] = useState({
    name: "",
    orgName: "",
    phone: "",
    email: "",
    consent: false,
    website: "", // 허니팟
  });
  const [utm, setUtm] = useState({ utmSource: "", utmCampaign: "" });
  const [consentOpen, setConsentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtm({
      utmSource: params.get("utm_source") ?? "",
      utmCampaign: params.get("utm_campaign") ?? "",
    });
  }, []);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("이름을 입력해 주세요.");
    if (!form.orgName.trim()) return setError("병원·사무소 이름을 입력해 주세요.");
    if (!form.phone.trim() && !form.email.trim())
      return setError("연락처 또는 이메일 중 하나는 입력해 주세요.");
    if (
      form.phone.trim() &&
      !/^01[016789]-?\d{3,4}-?\d{4}$/.test(form.phone.replace(/\s/g, ""))
    )
      return setError("휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)");
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email))
      return setError("이메일 형식을 확인해 주세요.");
    if (!form.consent) return setError("개인정보 수집·이용에 동의해 주세요.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/production/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "checklist",
          ...form,
          ...utm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setDone(true);
      if (pdfReady) {
        // 제출 완료 후 PDF 다운로드 시작
        window.location.href = "/checklist.pdf";
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 pb-24 pt-32">
      <div className="mx-auto max-w-xl">
        <FadeInSection>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Free Checklist
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
            유튜브 시작 체크리스트
          </h1>
          <p className="mt-5 text-base leading-relaxed text-sub-text">
            병원·법률 전문직이 첫 영상을 올리기 전에 꼭 확인해야 할 것들을 한
            장으로 정리했습니다. 아래 정보를 남겨주시면 바로 받아보실 수 있어요.
          </p>
        </FadeInSection>

        {done ? (
          <FadeInSection>
            <div className="mt-10 rounded-2xl border border-primary/40 bg-primary/5 p-10 text-center">
              <p className="text-2xl">✅</p>
              {pdfReady ? (
                <>
                  <h2 className="mt-4 text-xl font-bold text-white">
                    다운로드가 시작됩니다!
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-sub-text">
                    다운로드가 시작되지 않았다면{" "}
                    <a
                      href="/checklist.pdf"
                      className="font-semibold text-primary underline"
                    >
                      여기를 눌러주세요
                    </a>
                    .
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-xl font-bold text-white">
                    신청이 접수됐습니다!
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-sub-text">
                    체크리스트는 현재 준비 중입니다. 완성되는 대로 남겨주신
                    연락처로 보내드릴게요.
                  </p>
                </>
              )}
              <Link
                href="/production"
                className="mt-6 inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-semibold text-white transition-all hover:border-primary hover:text-primary"
              >
                유튜브 제작 서비스 보러가기 →
              </Link>
            </div>
          </FadeInSection>
        ) : (
          <FadeInSection delay={0.1}>
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              {/* 허니팟 */}
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />

              <div>
                <label className={labelClass}>
                  이름 <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="성함을 입력해 주세요"
                  autoComplete="name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  병원·사무소 이름 <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={form.orgName}
                  onChange={(e) => update("orgName", e.target.value)}
                  placeholder="예: OO정형외과 / 법무법인 OO"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>연락처</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="010-0000-0000"
                    autoComplete="tel"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>이메일</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="example@email.com"
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="-mt-2 text-xs text-sub-text/60">
                * 연락처 또는 이메일 중 하나만 입력하셔도 됩니다.
              </p>

              {/* 개인정보 동의 */}
              <div className="rounded-xl border border-border bg-card p-5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => update("consent", e.target.checked)}
                    className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[var(--color-primary,#c8a2ff)]"
                  />
                  <span className="text-sm text-sub-text">
                    <span className="font-semibold text-white">
                      개인정보 수집·이용에 동의합니다{" "}
                      <span className="text-primary">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setConsentOpen(!consentOpen)}
                      className="ml-2 text-xs text-primary underline"
                    >
                      {consentOpen ? "접기" : "내용 보기"}
                    </button>
                  </span>
                </label>
                {consentOpen && (
                  <div className="mt-4 rounded-lg bg-background p-4 text-xs leading-relaxed text-sub-text">
                    <p>· 수집 항목: 이름, 기관명, 연락처, 이메일</p>
                    <p>· 수집 목적: 체크리스트 발송 및 관련 안내 연락</p>
                    <p>
                      · 보유 기간: 수집일로부터 {privacy.retentionYears}년 (요청 시 즉시 파기)
                    </p>
                    <p>· 동의를 거부하실 수 있으나, 거부 시 다운로드가 어렵습니다.</p>
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-primary px-6 py-4 text-base font-bold text-background transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "접수 중..."
                  : pdfReady
                    ? "체크리스트 받기"
                    : "체크리스트 신청하기 (준비 중)"}
              </button>
            </form>
          </FadeInSection>
        )}
      </div>
    </div>
  );
}

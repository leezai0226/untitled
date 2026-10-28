"use client";

import { useEffect, useState } from "react";
import FadeInSection from "@/components/FadeInSection";
import { budgetRanges, contact, privacy } from "@/config/production";

/**
 * 기획 진단 신청 폼.
 * - 가격 카드에서 상품을 고르면 selectedPackage 로 미리 선택된다.
 * - utm_source / utm_campaign 을 URL에서 읽어 숨김 필드로 저장.
 * - 허니팟 필드(website) 포함.
 */

const PROFESSIONS = [
  { value: "hospital", label: "병원" },
  { value: "legal", label: "법률" },
  { value: "other", label: "기타 전문직" },
];

const GOALS = [
  "신규 환자·의뢰인",
  "전문가 브랜딩",
  "기존 고객 안내",
  "기타",
];

const AVAILABLE_TIMES = ["평일 오전", "평일 오후", "주말", "협의"];

const PACKAGES = ["기획 진단", "베이직", "스탠다드", "프리미엄", "아직 모름"];

const SOURCES = ["스레드", "인스타그램", "검색", "지인", "기타"];

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors";

const labelClass = "block text-sm font-medium text-sub-text mb-2";

export default function LeadForm({
  no,
  selectedPackage,
}: {
  no: string;
  selectedPackage: string | null;
}) {
  const [form, setForm] = useState({
    name: "",
    profession: "",
    orgName: "",
    specialty: "",
    phone: "",
    email: "",
    hasChannel: null as boolean | null,
    channelUrl: "",
    goals: [] as string[],
    availableTime: "",
    interestedPackage: "",
    budgetRange: "",
    message: "",
    source: "",
    consent: false,
    website: "", // 허니팟
  });
  const [utm, setUtm] = useState({ utmSource: "", utmCampaign: "" });
  const [consentOpen, setConsentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* URL 의 utm 파라미터 저장 (스레드 유입 확인용) */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtm({
      utmSource: params.get("utm_source") ?? "",
      utmCampaign: params.get("utm_campaign") ?? "",
    });
  }, []);

  /* 가격 카드에서 선택한 상품 반영 */
  useEffect(() => {
    if (selectedPackage) {
      const normalized =
        PACKAGES.find((p) => selectedPackage.includes(p.replace("기획 ", ""))) ??
        selectedPackage;
      setForm((prev) => ({ ...prev, interestedPackage: normalized }));
    }
  }, [selectedPackage]);

  const toggleGoal = (goal: string) =>
    setForm((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("이름을 입력해 주세요.");
    if (!form.profession) return setError("직군을 선택해 주세요.");
    if (!form.orgName.trim()) return setError("병원·사무소 이름을 입력해 주세요.");
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(form.phone.replace(/\s/g, "")))
      return setError("휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return setError("이메일 형식을 확인해 주세요.");
    if (form.hasChannel === null)
      return setError("유튜브 채널 보유 여부를 선택해 주세요.");
    if (!form.consent)
      return setError("개인정보 수집·이용에 동의해 주세요.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/production/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "diagnosis",
          ...form,
          channelUrl: form.hasChannel ? form.channelUrl : "",
          ...utm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "신청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setDone(true);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="apply" className="scroll-mt-24 border-t border-border/60 px-6 py-28">
      <div className="mx-auto max-w-2xl">
        <FadeInSection>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-primary">
            {no} — APPLY
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-white md:text-4xl">
            기획 진단 신청
          </h2>
          <p className="mt-6 text-base leading-relaxed text-sub-text">
            지금 상황을 남겨주시면 1영업일 안에 연락드리고,
            <br className="hidden md:block" />
            30분 진단 일정을 잡아드립니다.
          </p>
        </FadeInSection>

        {done ? (
          <FadeInSection>
            <div className="mt-12 rounded-2xl border border-primary/40 bg-primary/5 p-10 text-center">
              <p className="text-2xl">🎉</p>
              <h3 className="mt-4 text-xl font-bold text-white">
                신청 감사합니다!
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-sub-text">
                남겨주신 연락처로 <strong className="text-white">1영업일 안에</strong>{" "}
                연락드릴게요.
              </p>
              {contact.kakaoChannelUrl.trim() && (
                <a
                  href={contact.kakaoChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-6 py-3 text-sm font-bold text-[#191919] transition-all hover:brightness-95"
                >
                  💬 카카오톡으로 바로 문의하기
                </a>
              )}
            </div>
          </FadeInSection>
        ) : (
          <FadeInSection delay={0.1}>
            <form onSubmit={handleSubmit} className="mt-12 space-y-5">
              {/* 허니팟 — 사람에게는 보이지 않는 필드 */}
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

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                    직군 <span className="text-primary">*</span>
                  </label>
                  <div className="flex gap-2">
                    {PROFESSIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => update("profession", p.value)}
                        className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                          form.profession === p.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-sub-text hover:border-primary/50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                <div>
                  <label className={labelClass}>진료과·전문 분야</label>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={(e) => update("specialty", e.target.value)}
                    placeholder="예: 정형외과 / 이혼·상속"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    연락처 <span className="text-primary">*</span>
                  </label>
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

              <div>
                <label className={labelClass}>
                  유튜브 채널 <span className="text-primary">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => update("hasChannel", false)}
                    className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                      form.hasChannel === false
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-sub-text hover:border-primary/50"
                    }`}
                  >
                    아직 없어요
                  </button>
                  <button
                    type="button"
                    onClick={() => update("hasChannel", true)}
                    className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                      form.hasChannel === true
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-sub-text hover:border-primary/50"
                    }`}
                  >
                    운영 중이에요
                  </button>
                </div>
                {form.hasChannel === true && (
                  <input
                    type="url"
                    value={form.channelUrl}
                    onChange={(e) => update("channelUrl", e.target.value)}
                    placeholder="채널 주소를 붙여넣어 주세요"
                    className={`${inputClass} mt-3`}
                  />
                )}
              </div>

              <div>
                <label className={labelClass}>유튜브로 기대하는 것 (복수 선택)</label>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => toggleGoal(goal)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        form.goals.includes(goal)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-sub-text hover:border-primary/50"
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>촬영 가능한 시간</label>
                  <select
                    value={form.availableTime}
                    onChange={(e) => update("availableTime", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">선택해 주세요</option>
                    {AVAILABLE_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>관심 상품</label>
                  <select
                    value={form.interestedPackage}
                    onChange={(e) => update("interestedPackage", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">선택해 주세요</option>
                    {PACKAGES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>월 예산 범위</label>
                <select
                  value={form.budgetRange}
                  onChange={(e) => update("budgetRange", e.target.value)}
                  className={inputClass}
                >
                  <option value="">선택해 주세요</option>
                  {budgetRanges.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>하고 싶은 말</label>
                <textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="고민되는 점이나 궁금한 점을 편하게 남겨주세요"
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label className={labelClass}>어떻게 알게 되셨나요?</label>
                <select
                  value={form.source}
                  onChange={(e) => update("source", e.target.value)}
                  className={inputClass}
                >
                  <option value="">선택해 주세요</option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

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
                    <p>· 수집 항목: 이름, 직군, 기관명, 연락처, 이메일, 채널 정보, 상담 관련 입력 내용</p>
                    <p>· 수집 목적: 기획 진단 상담 진행 및 안내 연락</p>
                    <p>
                      · 보유 기간: 수집일로부터 {privacy.retentionYears}년 (요청 시 즉시 파기)
                    </p>
                    <p>· 동의를 거부하실 수 있으나, 거부 시 상담 진행이 어렵습니다.</p>
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
                {submitting ? "접수 중..." : "기획 진단 신청하기"}
              </button>

              <div className="flex items-center justify-center gap-4 pt-2 text-sm text-sub-text">
                {contact.kakaoChannelUrl.trim() && (
                  <a
                    href={contact.kakaoChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-primary"
                  >
                    💬 카톡으로 문의
                  </a>
                )}
                <a
                  href={`mailto:${contact.email}`}
                  className="transition-colors hover:text-primary"
                >
                  ✉️ 메일로 문의
                </a>
                <a
                  href={contact.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-primary"
                >
                  인스타 DM ↗
                </a>
              </div>
            </form>
          </FadeInSection>
        )}
      </div>
    </section>
  );
}

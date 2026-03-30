"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import FadeInSection from "@/components/FadeInSection";

/* ───────────────────────────── 타입 ───────────────────────────── */

interface ScheduleRow {
  id: string;
  class_type: string;
  schedule_label: string;
  max_seats: number;
  remaining_seats: number;
}

interface Schedule {
  id: string;
  label: string;
  remaining: number;
  max: number;
}

interface Benefit {
  title: string;
  desc: string;
}

interface Transformation {
  title: string;
  desc: string;
}

interface TabData {
  key: string;
  icon: string;
  label: string;
  recommendations: { tag: string; desc: string }[];
  curriculum: { period: string; title: string; duration: string; items: string[] }[];
  preparation: string[];
  prepNote: string;
  benefits: Benefit[];
  benefitsIntro: string;
  quote: string;
  transformations: Transformation[];
}

/* ───────────────────────────── FAQ (공통) ───────────────────────────── */

const faqs = [
  {
    q: "영상 편집은 태어나서 한 번도 안 해봤는데 괜찮을까요?",
    a: "완전 처음 시작하는 분들을 위해 기획되었습니다. 필수 기능만 직관적으로 알려드립니다.",
  },
  {
    q: "브이로그 반과 숏폼 반 중 어떤 걸 들어야 할까요?",
    a: "10분 내외 감성 영상은 [브이로그 반], 짧고 빠른 사업 홍보/정보 전달은 [숏폼 반]을 추천합니다. 두 클래스는 편집 템포가 완전히 다릅니다.",
  },
  {
    q: "노트북 사양이 좋아야 하나요? 맥/윈도우 상관없나요?",
    a: "프리미어 프로와 Vrew가 실행되는 노트북이면 OS 상관없이 가능합니다. 단, 마우스는 필수입니다.",
  },
  {
    q: "카메라가 없는데 스마트폰으로만 촬영해도 되나요?",
    a: "네! 스마트폰을 활용해 최적의 화질을 뽑아내는 법을 다룹니다.",
  },
  {
    q: "Vrew라는 프로그램은 유료인가요?",
    a: "무료 AI 자막 프로그램입니다. 수업 전 설치만 해오시면 획기적인 시간 단축 마법을 보여드립니다.",
  },
  {
    q: "환불 규정이 어떻게 되나요?",
    a: "클래스 진행일 7일 전까지 100% 환불, 5일 전까지 결제 금액의 50% 환불, 4일 이내에는 환불이 불가합니다.",
  },
];

/* ───────────────────────────── 탭 데이터 (일정 제외) ───────────────────────────── */

const tabs: TabData[] = [
  {
    key: "vlog",
    icon: "🎬",
    label: "초보 유튜버 브이로그 반,
    recommendations: [
      { tag: "입문자", desc: "영상 촬영과 편집을 배워보고 싶은 분" },
      { tag: "예비 유튜버", desc: "유튜브 시작하고 싶은데 고민만 하고 있던 분" },
      { tag: "기록가", desc: "평범한 일상을 내 손으로 영화처럼 기록하고 싶은 분" },
    ],
    curriculum: [
      {
        period: "1교시",
        title: "일상을 영화로 만드는 스마트폰 촬영 실습",
        duration: "1시간",
        items: ["카메라 세팅", "브이로그 컷 촬영 미니 실습"],
      },
      {
        period: "2교시",
        title: "프리미어 프로 적응 및 컷 편집의 리듬",
        duration: "1시간",
        items: ["초보자용 워크스페이스 세팅", "핵심 단축키 설정 및 컷 쳐내기"],
      },
      {
        period: "3교시",
        title: "자막 디테일 파고들기",
        duration: "1시간 30분",
        items: ["Vrew 텍스트 자동 변환", "자막 스타일과 모션 프리셋으로 밀도 높이기"],
      },
      {
        period: "4교시",
        title: "사운드 믹싱과 최종 완성",
        duration: "30분",
        items: ["BGM/목소리 밸런스", "최종 출력 및 피드백"],
      },
    ],
    preparation: [
      "노트북 (마우스 필수)",
      "프리미어 프로 & Vrew 설치",
      "스마트폰 여유 용량",
      "나의 일상 조각 영상 10개",
    ],
    prepNote: "자세한 내용은 추후 공지 예정",
    benefitsIntro: "수업이 끝나도 혼자서 영상을 만들 수 있도록, 실무자가 쓰는 무기를 그대로 쥐어드립니다.",
    benefits: [
      { title: "무제한 1:1 피드백", desc: "수업 종료 후 막히는 부분, 새로운 영상 피드백 등 무한 애프터서비스 제공" },
      { title: "자막 Style 파일", desc: "불러오기만 하면 끝나는 세련된 감성 자막 & 비즈니스 가독성 자막 세팅" },
      { title: "모션 프리셋", desc: "영상의 밀도를 높여주는 건 자막의 모션입니다. 하나하나 설정하지 않고 프리셋 적용만 하면 끝!" },
      { title: "MOV 효과 소스", desc: "브이로그에서 자주 쓰이는 효과 소스 파일을 제공해드립니다." },
    ],
    quote: "나의 평범한 하루가 꽤 멋진 기록으로 남습니다.",
    transformations: [
      {
        title: "평범한 일상이 영화가 되는 시선을 갖게 됩니다.",
        desc: "거창한 여행지나 대단한 장비가 없어도 괜찮습니다. 내 방구석, 책상 위의 소박한 순간들을 스마트폰 카메라로 감성적으로 담아내는 법을 깨닫게 됩니다.",
      },
      {
        title: "편집의 두려움이 설렘으로 바뀝니다.",
        desc: "무겁게만 느껴졌던 프리미어 프로가 친숙해집니다. 백지상태의 타임라인을 채워나가는 막막함 대신, 내 입맛에 맞게 자막과 음악을 고르며 나만의 영상 일기를 완성하는 재미를 알게 됩니다.",
      },
      {
        title: "나만의 첫 브이로그 결과물을 갖게 됩니다.",
        desc: "머릿속으로만 생각하고 미뤄뒀던 첫 영상이 내 손에서 탄생합니다. 서툴러도 온전히 내 시선이 담긴 소중한 결과물을 안고 가벼운 마음으로 돌아가실 수 있습니다.",
      },
    ],
  },
  {
    key: "shortform",
    icon: "📱",
    label: "1인 사업자 숏폼 반",
    recommendations: [
      { tag: "1인 사업가", desc: "내 사업장(매장, 연구소 등)을 홍보하고 싶으신 분" },
      { tag: "지식 크리에이터", desc: "전문 지식을 정보성 숏폼으로 만들고 싶은 분" },
      { tag: "SNS 수익화", desc: "SNS로 퍼스널 브랜딩 및 수익화 해보고 싶은 분" },
    ],
    curriculum: [
      {
        period: "1교시",
        title: "3초 훅(Hook)과 실전 촬영",
        duration: "1시간",
        items: ["3초 문장 공식", "폰카 수직수평 세팅", "맞춤 소스 만들기 실습"],
      },
      {
        period: "2교시",
        title: "이탈률을 낮추는 컷 편집",
        duration: "1시간",
        items: ["9:16 모바일 시퀀스 세팅", "AI 빈 공간 삭제 및 단축키 활용"],
      },
      {
        period: "3교시",
        title: "Vrew와 템플릿으로 자막 찍어내기",
        duration: "1시간",
        items: ["가독성 높은 폰트 세팅", "자막 스타일/모션 프리셋 활용"],
      },
      {
        period: "4교시",
        title: "배경 음악과 실행력 장착",
        duration: "1시간",
        items: ["오디오 더킹 스킬", "영상 템플릿화", "SNS 즉시 업로드 미션"],
      },
    ],
    preparation: [
      "노트북 (마우스 필수)",
      "프리미어 프로 & Vrew 설치",
      "내 사업/전문 지식에 대한 30초 대본 준비",
    ],
    prepNote: "자세한 내용은 추후 공지 예정",
    benefitsIntro: "수업이 끝나도 혼자서 영상을 만들 수 있도록, 실무자가 쓰는 무기를 그대로 쥐어드립니다.",
    benefits: [
      { title: "무제한 1:1 피드백", desc: "수업 종료 후 막히는 부분, 새로운 영상 피드백 등 무한 애프터서비스 제공" },
      { title: "모션 프리셋", desc: "영상의 밀도를 높여주는 건 자막의 모션입니다. 하나하나 설정하지 않고 프리셋 적용만 하면 끝!" },
      { title: "트렌디한 효과음(SFX) 팩", desc: "영상의 맛을 확 살려주는 효과음 모음집 50가지" },
      { title: "트렌지션 효과 영상", desc: "숏폼에서 자주 쓰이는 Film Burn 효과 파일 제공" },
    ],
    quote: "혼자서도 거뜬한 1인 마케팅 무기가 생깁니다.",
    transformations: [
      {
        title: "발목을 잡던 '완벽주의'에서 완전히 벗어납니다.",
        desc: "잘 만들어야 한다는 압박감 때문에 매번 기획만 하다 포기했던 과거와 이별합니다. 힘을 빼고 거칠게라도 일단 만들어서 업로드 버튼을 누르는, 꾸준함의 감각을 확실하게 장착하게 됩니다.",
      },
      {
        title: "시간을 절반으로 줄여주는 '자막 공장'이 가동됩니다.",
        desc: "매번 영상마다 자막을 타이핑하고 디자인할 필요가 없습니다. Vrew(AI 자막)와 현업 실무자용 자막 템플릿을 무기 삼아, 뚝딱 빠르게 영상을 찍어내는 압도적인 효율을 경험하게 됩니다.",
      },
      {
        title: "대행사 없이 스스로 해내는 자생력이 생깁니다.",
        desc: "더 이상 비싼 돈을 들여 외주를 맡기지 않아도 됩니다. 내 사업장, 내 전문 지식을 내 목소리로 직접 홍보하며 고객과 소통하는 든든한 온라인 영업사원을 매일매일 내 손으로 만들어낼 수 있습니다.",
      },
    ],
  },
];

/* ───────────────── 재사용 서브 컴포넌트: 일정 선택 ───────────────── */

function ScheduleChips({
  schedules,
  selectedSchedule,
  onSelect,
}: {
  schedules: Schedule[];
  selectedSchedule: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {schedules.map((schedule) => {
        const isSoldOut = schedule.remaining <= 0;
        const isSelected = selectedSchedule === schedule.id;
        const isUrgent = schedule.remaining > 0 && schedule.remaining <= 2;

        const dot = isSoldOut ? "⚫" : isUrgent ? schedule.remaining === 1 ? "🔴" : "🟡" : "🟢";
        const statusText = isSoldOut
          ? "마감"
          : `${schedule.remaining}자리 남음`;
        const statusColor = isSoldOut
          ? "text-sub-text"
          : isUrgent
            ? "text-yellow-400"
            : "text-green-400";

        return (
          <button
            key={schedule.id}
            onClick={() => !isSoldOut && onSelect(schedule.id)}
            disabled={isSoldOut}
            className={`flex-1 rounded-xl border p-5 text-left transition-all duration-200 ${
              isSoldOut
                ? "border-border bg-card/50 opacity-60 cursor-not-allowed"
                : isSelected
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border bg-card hover:border-primary/50 cursor-pointer"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{dot}</span>
              <span className={`font-display text-base font-semibold ${isSoldOut ? "text-sub-text line-through" : "text-white"}`}>
                {schedule.label}
              </span>
            </div>
            <p className={`mt-2 text-sm font-medium ${statusColor}`}>
              {isSoldOut ? "수강 마감" : isUrgent ? "마감 임박" : "예약 가능"} ({statusText})
            </p>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────── 재사용 서브 컴포넌트: FAQ 아코디언 아이템 ───────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <span className="pr-4 text-base font-semibold text-white">Q. {q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 text-xl text-white"
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-6 pb-6 pt-4">
              <p className="text-base leading-relaxed text-white">A. {a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────────── 메인 페이지 ───────────────────────────── */

export default function ClassPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [dbSchedules, setDbSchedules] = useState<Record<string, Schedule[]>>({
    vlog: [],
    shortform: [],
  });
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  /* ── DB에서 잔여 좌석 불러오기 ── */
  useEffect(() => {
    const fetchSchedules = async () => {
      const { data, error } = await supabase
        .from("class_schedules")
        .select("*")
        .order("created_at");

      if (error) {
        console.error("일정 조회 실패:", error.message);
        setSchedulesLoaded(true);
        return;
      }

      const rows = (data as ScheduleRow[]) ?? [];
      const mapped: Record<string, Schedule[]> = { vlog: [], shortform: [] };

      for (const row of rows) {
        const type = row.class_type as "vlog" | "shortform";
        if (mapped[type]) {
          mapped[type].push({
            id: row.id,
            label: row.schedule_label,
            remaining: row.remaining_seats,
            max: row.max_seats,
          });
        }
      }

      setDbSchedules(mapped);
      setSchedulesLoaded(true);
    };
    fetchSchedules();
  }, []);

  const current = tabs[activeTab];
  const currentSchedules = dbSchedules[current.key] ?? [];

  const selectedScheduleLabel =
    currentSchedules.find((s) => s.id === selectedSchedule)?.label ?? null;

  const selectedScheduleData = currentSchedules.find(
    (s) => s.id === selectedSchedule
  );
  const isSelectedSoldOut = selectedScheduleData
    ? selectedScheduleData.remaining <= 0
    : false;

  const handleCheckout = () => {
    if (!selectedSchedule) {
      alert("일정을 먼저 선택해 주세요");
      return;
    }
    if (isSelectedSoldOut) {
      alert("수강 마감된 일정입니다.");
      return;
    }
    const params = new URLSearchParams({
      class: `${current.icon} ${current.label}`,
      schedule: selectedScheduleLabel ?? "",
      schedule_id: selectedSchedule,
    });
    router.push(`/checkout?${params.toString()}`);
  };

  const switchTab = (idx: number) => {
    setActiveTab(idx);
    setSelectedSchedule(null);
    setPrepOpen(false);
  };

  return (
    <div className="pt-20 pb-28">
      {/* ─── 탭 버튼 ─── */}
      <section className="mx-auto max-w-4xl px-6 pt-12">
        <div className="flex gap-3">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => switchTab(i)}
              className={`relative flex-1 rounded-xl py-4 text-center font-semibold transition-all duration-200 text-base sm:text-lg ${
                activeTab === i
                  ? "bg-primary text-background shadow-lg shadow-primary/25"
                  : "border border-border bg-card text-white hover:border-primary/50"
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ─── 탭 콘텐츠 ─── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          {/* ① 수강 일정 선택 (Top) */}
          <section className="mx-auto max-w-4xl px-6 pt-16">
            <FadeInSection>
              <h2 className="text-2xl font-bold md:text-3xl text-white">
                수강 <span className="text-primary">일정</span> 선택
              </h2>
              <p className="mt-2 text-base text-white">
                밀착 코칭을 위해 클래스당 최대{" "}
                <span className="font-semibold text-primary">4명</span> 소수 정예 진행
              </p>
            </FadeInSection>
            <div className="mt-8">
              {schedulesLoaded ? (
                currentSchedules.length > 0 ? (
                  <ScheduleChips
                    schedules={currentSchedules}
                    selectedSchedule={selectedSchedule}
                    onSelect={setSelectedSchedule}
                  />
                ) : (
                  <p className="text-sub-text text-center py-6">현재 예약 가능한 일정이 없습니다.</p>
                )
              ) : (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              <p className="mt-4 text-sm font-medium text-sub-text">
                📍 수강 장소: 인천타워대로 301 센텀하이브
              </p>
            </div>
          </section>

          {/* ② 이런 분들께 추천해요 */}
          <section className="mx-auto max-w-4xl px-6 pt-20">
            <FadeInSection>
              <h2 className="text-2xl font-bold md:text-3xl text-white">
                이런 분들께 <span className="text-primary">추천</span>해요
              </h2>
            </FadeInSection>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 items-stretch">
              {current.recommendations.map((rec, i) => (
                <FadeInSection key={rec.tag} delay={i * 0.1} className="flex">
                  <div className="flex flex-col justify-center w-full rounded-xl border border-border bg-card px-8 py-10 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                    <h3 className="text-xl font-bold text-primary">
                      {rec.tag}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-white">
                      {rec.desc}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ③ 세부 커리큘럼 */}
          <section className="mx-auto max-w-4xl px-6 pt-20">
            <FadeInSection>
              <h2 className="text-2xl font-bold md:text-3xl text-white">
                세부 <span className="text-primary">커리큘럼</span>
              </h2>
            </FadeInSection>
            <div className="mt-8 space-y-4">
              {current.curriculum.map((lesson, i) => (
                <FadeInSection key={lesson.period} delay={i * 0.1}>
                  <div className="rounded-xl border border-border bg-card p-7 transition-all duration-300 hover:border-primary/30">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-base font-bold text-primary">
                          {lesson.period}
                        </span>
                        <h3 className="text-lg font-semibold text-white">{lesson.title}</h3>
                      </div>
                      <span className="font-display text-sm font-medium text-white">
                        {lesson.duration}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {lesson.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-base text-white">
                          <span className="mt-0.5 text-primary">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ④ 수강생 사전 준비물 (아코디언) */}
          <section className="mx-auto max-w-4xl px-6 pt-20">
            <FadeInSection>
              <button
                onClick={() => setPrepOpen(!prepOpen)}
                className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-7 transition-all duration-200 hover:border-primary/50"
              >
                <h2 className="text-xl font-bold text-white">
                  🎒 수강생 사전 준비물
                </h2>
                <motion.span
                  animate={{ rotate: prepOpen ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-xl text-white"
                >
                  ▾
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {prepOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-b-xl border border-t-0 border-border bg-card px-7 pb-7 pt-3">
                      <ul className="space-y-3">
                        {current.preparation.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-base text-white">
                            <span className="mt-0.5 text-primary">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-5 text-xs text-sub-text">
                        {current.prepNote}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </FadeInSection>
          </section>

          {/* ⑤ 오직 수강생에게만 제공되는 혜택 4가지 */}
          <section className="mx-auto max-w-4xl px-6 pt-20">
            <FadeInSection>
              <h2 className="text-2xl font-bold md:text-3xl text-white">
                🎁 오직 수강생에게만 제공되는{" "}
                <span className="text-primary">혜택 4가지</span>
              </h2>
              <p className="mt-3 text-base text-white">
                {current.benefitsIntro}
              </p>
            </FadeInSection>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {current.benefits.map((b, i) => (
                <FadeInSection key={b.title} delay={i * 0.1}>
                  <div className="rounded-xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 h-full">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
                        {i + 1}
                      </span>
                      <h3 className="text-lg font-bold text-white">{b.title}</h3>
                    </div>
                    <p className="mt-3 text-base leading-relaxed text-white">
                      {b.desc}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ⑥ 이 클래스를 듣고 나면 이렇게 변합니다 */}
          <section className="mx-auto max-w-4xl px-6 pt-20">
            <FadeInSection>
              <h2 className="text-2xl font-bold md:text-3xl text-white">
                ✨ 이 클래스를 듣고 나면{" "}
                <span className="text-primary">이렇게 변합니다</span>
              </h2>
            </FadeInSection>
            <FadeInSection delay={0.1}>
              <p className="mt-8 text-center text-2xl font-bold leading-snug text-primary md:text-3xl">
                &ldquo;{current.quote}&rdquo;
              </p>
            </FadeInSection>
            <div className="mt-10 space-y-4">
              {current.transformations.map((t, i) => (
                <FadeInSection key={i} delay={i * 0.12}>
                  <div className="rounded-xl border border-border bg-card p-7 transition-all duration-300 hover:border-primary/30">
                    <h3 className="text-lg font-bold text-primary">{t.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-white">
                      {t.desc}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ⑦ 자주 묻는 질문 (FAQ) */}
          <section className="mx-auto max-w-4xl px-6 pt-20">
            <FadeInSection>
              <h2 className="text-2xl font-bold md:text-3xl text-white">
                🙋‍♀️ 자주 묻는 <span className="text-primary">질문</span>
              </h2>
            </FadeInSection>
            <div className="mt-8 space-y-3">
              {faqs.map((faq, i) => (
                <FadeInSection key={i} delay={i * 0.06}>
                  <FaqItem q={faq.q} a={faq.a} />
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ⑧ 수강 일정 선택 (Bottom - Top과 동기화) */}
          <section className="mx-auto max-w-4xl px-6 pt-20">
            <FadeInSection>
              <h2 className="text-2xl font-bold md:text-3xl text-white">
                수강 <span className="text-primary">일정</span> 선택
              </h2>
              <p className="mt-2 text-base text-white">
                밀착 코칭을 위해 클래스당 최대{" "}
                <span className="font-semibold text-primary">4명</span> 소수 정예 진행
              </p>
            </FadeInSection>
            <div className="mt-8">
              {schedulesLoaded && currentSchedules.length > 0 && (
                <ScheduleChips
                  schedules={currentSchedules}
                  selectedSchedule={selectedSchedule}
                  onSelect={setSelectedSchedule}
                />
              )}
              <p className="mt-4 text-sm font-medium text-sub-text">
                📍 수강 장소: 인천타워대로 301 센텀하이브
              </p>
            </div>
          </section>
        </motion.div>
      </AnimatePresence>

      {/* ─── Sticky Checkout Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          {/* 선택 내역 + 금액 */}
          <div className="min-w-0 flex-1 mr-4">
            <p className="truncate text-base text-white">
              {current.icon} {current.label}
              {selectedScheduleLabel && (
                <>
                  <span className="mx-1.5 text-border">|</span>
                  <span className="font-semibold text-white">{selectedScheduleLabel}</span>
                </>
              )}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-base text-sub-text line-through">
                399,000원
              </span>
              <span className="font-display text-xl font-bold text-primary">
                299,000원
              </span>
            </div>
          </div>

          {/* 버튼 */}
          <button
            onClick={handleCheckout}
            className="shrink-0 rounded-xl bg-primary px-6 py-3 text-lg font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 sm:px-8 sm:py-4"
          >
            수강 신청하기
          </button>
        </div>
      </div>
    </div>
  );
}

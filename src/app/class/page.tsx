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
  originalPrice: number;
  salePrice: number;
  duration: string;
  maxStudents: number;
  recommendations: { tag: string; desc: string }[];
  curriculum: {
    period: string;
    title: string;
    subtitle: string;
    duration: string;
    items: string[];
    tip: string;
  }[];
  preparation: string[];
  prepNote: string;
  benefits: Benefit[];
  benefitsIntro: string;
  benefitCount: number;
  quote: string;
  transformations: Transformation[];
}

/* ───────────────────────────── FAQ (공통) ───────────────────────────── */

const faqs = [
  {
    q: "영상 편집은 한 번도 안 해봤는데 괜찮을까요?",
    a: "초급반은 프리미어 프로를 한 번도 열어본 적 없는 분을 기준으로 만들었습니다. 마우스 클릭부터 시작하니 걱정 마세요.",
  },
  {
    q: "초급반과 중급반 중 어떤 걸 들어야 할까요?",
    a: "프리미어 프로를 한 번도 써본 적 없다면 초급반, 기본 컷 편집은 할 줄 알지만 영상이 밋밋하게 느껴진다면 중급반을 추천합니다.",
  },
  {
    q: "초급반만 들어도 영상을 만들 수 있나요?",
    a: "네! 초급반만으로도 편집-자막-내보내기까지 한 편을 완성할 수 있습니다. 더 프로 수준의 퀄리티를 원하시면 중급반에서 레벨업하세요.",
  },
  {
    q: "2시간이면 너무 짧지 않나요?",
    a: "넓게 훑는 대신, 핵심만 집중해서 배웁니다. 초급반은 '영상 한 편 완성', 중급반은 '프로 퀄리티 업그레이드'라는 명확한 목표가 있어서 2시간 안에 충분히 달성할 수 있습니다.",
  },
  {
    q: "브이로그와 숏폼 중 뭘 배우나요?",
    a: "장르를 나누지 않습니다. 초급에서는 모든 영상의 기본인 컷 편집과 자막을, 중급에서는 브이로그·숏폼 모두에 쓸 수 있는 고급 편집 기술을 다룹니다.",
  },
  {
    q: "편집할 영상이 없는데 괜찮나요?",
    a: "연습용 영상 소스를 제공해드리니 걱정 마세요. 물론 본인 영상이 있으면 바로 활용할 수 있어서 더 좋습니다.",
  },
  {
    q: "노트북 사양이 좋아야 하나요?",
    a: "프리미어 프로와 Vrew가 실행되는 노트북이면 OK. 맥/윈도우 모두 가능하고, 마우스는 필수입니다.",
  },
  {
    q: "환불 규정이 어떻게 되나요?",
    a: "클래스 진행일 7일 전까지 100% 환불, 5일 전까지 50% 환불, 4일 이내에는 환불이 불가합니다.",
  },
];

/* ───────────────────────────── 탭 데이터 ───────────────────────────── */

const tabs: TabData[] = [
  {
    key: "beginner",
    icon: "📗",
    label: "초급반",
    originalPrice: 129000,
    salePrice: 89000,
    duration: "2시간",
    maxStudents: 5,
    recommendations: [
      { tag: "완전 처음인 분", desc: "영상 편집 프로그램을 한 번도 열어본 적 없는 분" },
      { tag: "시작이 어려운 분", desc: "유튜브·인스타 해보고 싶은데 첫 발을 못 떼고 있는 분" },
      { tag: "기록하고 싶은 분", desc: "여행, 카페, 일상을 영상으로 남기고 싶은 분" },
    ],
    curriculum: [
      {
        period: "1교시",
        title: "프리미어 프로 첫 걸음, 컷 편집",
        subtitle: "프리미어 프로를 처음 열어서 영상을 자르고 붙이는 것까지",
        duration: "50분",
        items: [
          "프리미어 프로 세팅: 영상 파일 가져오기, 편집 화면 정리하기",
          "꼭 필요한 단축키 셋팅: 이것만 알면 편집 속도가 2배",
          "컷 편집 실습: 영상을 타임라인에 올리고, 필요 없는 부분 자르고, 순서 바꾸기",
          "음악 넣기: 무료 BGM 찾는 법 + 음악 박자에 맞춰 장면 전환하는 감각 익히기",
        ],
        tip: "마우스로 드래그하고 자르는 것부터 시작합니다. 어렵지 않아요.",
      },
      {
        period: "2교시",
        title: "AI 자막 + 마무리, 영상 완성",
        subtitle: "AI가 자막을 만들어주고, 음악 넣고, 완성본을 뽑아내는 것까지",
        duration: "50분",
        items: [
          "Vrew 자막 자동 생성: AI가 목소리를 자동으로 자막으로 바꿔주는 무료 프로그램 활용법",
          "자막 프리미어 프로로 불러오기: 클릭 몇 번이면 끝나는 연결 방법",
          "음악 + 소리 마무리: 음악과 목소리 볼륨 균형 맞추기",
          "최종 영상 내보내기(렌더링): 고화질로 파일을 뽑아내는 마지막 단계",
        ],
        tip: "Vrew는 AI가 목소리를 자동으로 자막으로 바꿔주는 무료 프로그램이에요. 수업 전 설치만 해오시면 됩니다.",
      },
      {
        period: "마무리",
        title: "완성작 시사 + 피드백",
        subtitle: "",
        duration: "20분",
        items: [
          "각자 만든 영상을 함께 보며 간단한 피드백",
          "혼자 연습할 때 참고할 포인트 정리",
        ],
        tip: "수업이 끝나면: 2시간 전엔 프리미어 프로를 열어본 적도 없던 내가, 영상 한 편을 완성해서 가져갑니다.",
      },
    ],
    preparation: [
      "노트북 (맥/윈도우 모두 가능) + 마우스 필수",
      "프리미어 프로 설치 (무료 체험판 가능 — 설치 가이드 사전 안내)",
      "Vrew 설치 (무료 — 설치 링크 사전 안내)",
      "편집할 영상 소스 (직접 찍은 영상, 없으면 연습용 소스 제공)",
    ],
    prepNote: "자세한 설치 방법은 수강 확정 후 안내드립니다.",
    benefitsIntro: "수업이 끝나도 혼자서 영상을 만들 수 있도록, 실무자가 쓰는 도구를 그대로 드립니다.",
    benefitCount: 3,
    benefits: [
      { title: "무제한 1:1 피드백", desc: "수업 끝나고 막히는 부분, 새 영상 피드백 등 계속 질문 가능" },
      { title: "자막 디자인 템플릿", desc: "불러오기 한 번이면 깔끔한 자막이 자동 적용되는 파일" },
      { title: "중급반 할인 쿠폰", desc: "초급반 수강생 한정, 중급반 수강 시 2만 원 특별 할인" },
    ],
    quote: "2시간 전의 나는 프리미어 프로가 뭔지도 몰랐는데, 지금은 영상 한 편을 들고 돌아갑니다.",
    transformations: [
      {
        title: "프리미어 프로가 더 이상 무섭지 않습니다.",
        desc: "처음 열면 복잡해 보이지만, 실은 버튼 몇 개면 충분합니다. 2시간 뒤에는 \"이게 전부야?\"라는 생각이 들 거예요.",
      },
      {
        title: "내 일상이 콘텐츠가 되는 눈이 생깁니다.",
        desc: "편집할 줄 알게 되면, 눈에 보이는 모든 것이 영상 소재가 됩니다. 카페 한 잔, 퇴근길 노을, 주말 요리 — 전부 콘텐츠입니다.",
      },
      {
        title: "'다음 영상'을 만들고 싶어집니다.",
        desc: "첫 영상을 완성하는 순간, 더 잘 만들고 싶은 욕심이 생깁니다. 그때 중급반이 기다리고 있습니다.",
      },
    ],
  },
  {
    key: "intermediate",
    icon: "📘",
    label: "중급반",
    originalPrice: 199000,
    salePrice: 129000,
    duration: "2시간",
    maxStudents: 5,
    recommendations: [
      { tag: "초급반 수료자", desc: "컷 편집은 할 줄 아는데, 영상이 아직 밋밋한 분" },
      { tag: "독학 편집러", desc: "유튜브로 배웠는데 체계적으로 레벨업하고 싶은 분" },
      { tag: "1인 사업자", desc: "내 사업장·제품을 직접 영상으로 홍보하고 싶은 분" },
    ],
    curriculum: [
      {
        period: "1교시",
        title: "시청자를 붙잡는 편집 테크닉",
        subtitle: "영상이 밋밋한 이유를 알고, 확 달라지는 디테일을 배웁니다",
        duration: "50분",
        items: [
          "인서트 편집: 말하는 영상 사이사이에 보조 영상 컷(B-Roll) 끼워 넣어 지루하지 않은 영상 만들기",
          "AI로 편집 속도 올리기: 말 더듬거나 쉬는 구간을 AI가 자동으로 잘라내는 방법",
          "첫 3초 만들기: 시청자가 스크롤을 멈추게 하는 오프닝 효과 실습",
          "효과음 넣기: '뿅', '틱', '슝' 같은 효과음(SFX)을 적절한 타이밍에 넣는 법 (효과음 제공)",
        ],
        tip: "초급과의 차이: 초급에서 '자르고 붙이기'를 배웠다면, 중급에서는 '왜 이렇게 자르는지'를 배웁니다.",
      },
      {
        period: "2교시",
        title: "자막 + 모션으로 프로 퀄리티 만들기",
        subtitle: "똑같은 영상인데, 자막과 효과만 바꿔도 완전히 달라집니다",
        duration: "50분",
        items: [
          "고급 자막 디자인: 감성 자막, 강조 자막, 배경 박스 — 상황별 자막 스타일 만들기",
          "자막 애니메이션(모션): 자막이 톡톡 튀어나오는 효과를 프리셋으로 한 번에 적용",
          "나만의 자막 템플릿 저장: 매번 처음부터 만들지 않고, 내 스타일을 저장해서 재사용",
          "밋밋한 영상에 효과 더하기: 영상이 조금 밋밋할 때 필요한 효과들을 넣어보기 (효과 파일 제공)",
        ],
        tip: "이 수업에서 만든 자막 템플릿은 앞으로 모든 영상에 계속 쓸 수 있습니다.",
      },
      {
        period: "마무리",
        title: "1:1 피드백 + 내보내기",
        subtitle: "",
        duration: "20분",
        items: [
          "소리 마무리: 음악과 목소리 크기 균일하게 맞추기",
          "내보내기 설정: 유튜브용 / 인스타 릴스용 / 숏폼용 각각에 맞는 설정",
          "1:1 피드백: 각자의 영상을 함께 보며 구체적인 개선점 코칭",
        ],
        tip: "수업이 끝나면: 같은 영상인데 편집만 바꿨을 뿐인데, 완전히 다른 영상이 됩니다.",
      },
    ],
    preparation: [
      "노트북 (맥/윈도우 모두 가능) + 마우스 필수",
      "프리미어 프로 설치",
      "Vrew 설치",
      "본인 영상 소스 — 직접 편집하고 싶은 영상 (없으면 연습용 소스 제공)",
    ],
    prepNote: "자세한 설치 방법은 수강 확정 후 안내드립니다.",
    benefitsIntro: "수업이 끝나도 혼자서 프로 퀄리티 영상을 만들 수 있도록, 실무 도구를 그대로 드립니다.",
    benefitCount: 4,
    benefits: [
      { title: "무제한 1:1 피드백", desc: "수업 끝나고도 계속 — 새 영상 피드백, 막히는 부분 질문 무제한" },
      { title: "자막 애니메이션 프리셋", desc: "클릭 한 번으로 자막에 움직임을 넣는 모션 효과 파일" },
      { title: "효과음 모음집 50개", desc: "'뿅', '틱', '슝' 같은 영상의 맛을 살려주는 효과음 팩" },
      { title: "장면 전환 효과 영상", desc: "필름이 타는 듯한 효과 등 바로 쓸 수 있는 전환 효과 파일" },
    ],
    quote: "같은 소스, 같은 영상인데 — 편집만 바꿨을 뿐인데 완전히 다른 결과물이 나옵니다.",
    transformations: [
      {
        title: "'아마추어 느낌'에서 벗어납니다.",
        desc: "자막 하나, 효과음 하나, 장면 전환 하나. 디테일 몇 가지만 추가해도 영상의 완성도가 확 달라집니다.",
      },
      {
        title: "나만의 편집 시스템이 생깁니다.",
        desc: "매번 처음부터 시작하는 게 아니라, 저장해둔 자막 템플릿과 프리셋을 꺼내 쓰는 효율적인 편집 루틴을 갖게 됩니다.",
      },
      {
        title: "대행사 없이 내 콘텐츠를 직접 만듭니다.",
        desc: "사업 홍보든, 일상 기록이든 — 외주 맡기지 않고 내 손으로 만드는 자생력이 생깁니다.",
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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
            className={`flex-1 min-w-[200px] rounded-xl border p-4 text-left transition-all duration-200 sm:p-5 ${
              isSoldOut
                ? "border-border bg-card/50 opacity-60 cursor-not-allowed"
                : isSelected
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border bg-card hover:border-primary/50 cursor-pointer"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base">{dot}</span>
              <span className={`font-display text-sm font-semibold sm:text-base ${isSoldOut ? "text-sub-text line-through" : "text-white"}`}>
                {schedule.label}
              </span>
            </div>
            <p className={`mt-2 text-xs font-medium sm:text-sm ${statusColor}`}>
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
        className="flex w-full items-center justify-between p-5 text-left sm:p-6"
      >
        <span className="pr-3 text-sm font-semibold leading-relaxed text-white sm:pr-4 sm:text-base">Q. {q}</span>
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
            <div className="border-t border-border px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <p className="text-sm leading-relaxed text-white sm:text-base">A. {a}</p>
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
    beginner: [],
    intermediate: [],
  });
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [hasBeginnerOrder, setHasBeginnerOrder] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  /* ── DB에서 잔여 좌석 + 초급반 수강 여부 불러오기 ── */
  useEffect(() => {
    const fetchData = async () => {
      // 일정 조회
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
      const mapped: Record<string, Schedule[]> = { beginner: [], intermediate: [] };

      for (const row of rows) {
        const type = row.class_type as "beginner" | "intermediate";
        if (mapped[type]) {
          mapped[type].push({
            id: row.id,
            label: row.schedule_label,
            remaining: row.remaining_seats,
            max: row.max_seats,
          });
        }
      }

      // schedule_label에서 월/일을 파싱하여 빠른 순으로 정렬
      const parseLabelDate = (label: string): number => {
        const match = label.match(/^(\d{1,2})\/(\d{1,2})/);
        if (!match) return Number.MAX_SAFE_INTEGER;
        const month = parseInt(match[1], 10);
        const day = parseInt(match[2], 10);
        return month * 100 + day;
      };

      const sortByDate = (a: Schedule, b: Schedule) =>
        parseLabelDate(a.label) - parseLabelDate(b.label);

      mapped.beginner.sort(sortByDate);
      mapped.intermediate.sort(sortByDate);

      setDbSchedules(mapped);
      setSchedulesLoaded(true);

      // 초급반 수강 이력 확인 (할인 적용 여부)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id")
          .eq("user_id", user.id)
          .eq("order_type", "class")
          .eq("status", "completed")
          .ilike("class_name", "%초급반%")
          .limit(1);

        if (orders && orders.length > 0) {
          setHasBeginnerOrder(true);
        }
      }
    };
    fetchData();
  }, []);

  const current = tabs[activeTab];
  const currentSchedules = dbSchedules[current.key] ?? [];

  // 중급반이면서 초급반 수강 이력이 있으면 2만원 할인
  const isIntermediateDiscount = current.key === "intermediate" && hasBeginnerOrder;
  const discountAmount = isIntermediateDiscount ? 20000 : 0;
  const finalPrice = current.salePrice - discountAmount;

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
      class_type: current.key,
      price: String(finalPrice),
    });
    router.push(`/checkout?${params.toString()}`);
  };

  const switchTab = (idx: number) => {
    setActiveTab(idx);
    setSelectedSchedule(null);
    setPrepOpen(false);
  };

  return (
    <div className="pt-20 pb-32 break-keep">
      {/* ─── 탭 버튼 ─── */}
      <section className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="flex gap-2 sm:gap-3">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => switchTab(i)}
              className={`relative flex-1 rounded-xl px-2 py-3 text-center font-semibold transition-all duration-200 text-sm sm:py-4 sm:text-lg ${
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
          {/* ── 클래스 소개 헤더 ── */}
          <section className="mx-auto max-w-4xl px-4 pt-10 sm:px-6 sm:pt-14">
            <FadeInSection>
              <p className="text-sm text-sub-text sm:text-base">
                {current.icon} {current.duration} · 정원 최대 {current.maxStudents}명
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                {current.key === "beginner"
                  ? "2시간 만에 내 첫 영상 완성"
                  : "이제 진짜 있어 보이게"}
              </h1>
              <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="font-display text-base text-sub-text line-through sm:text-lg">
                  {current.originalPrice.toLocaleString("ko-KR")}원
                </span>
                <span className="font-display text-2xl font-bold text-primary sm:text-3xl">
                  {current.salePrice.toLocaleString("ko-KR")}원
                </span>
              </div>
              {isIntermediateDiscount && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary/15 px-4 py-2">
                  <span className="text-sm font-bold text-primary sm:text-base">
                    🎉 초급반 수강생 전용 2만 원 할인 적용 중!
                  </span>
                  <span className="font-display text-lg font-bold text-white sm:text-xl">
                    → {finalPrice.toLocaleString("ko-KR")}원
                  </span>
                </div>
              )}
              {current.key === "intermediate" && !hasBeginnerOrder && (
                <p className="mt-3 text-sm text-sub-text">
                  📦 초급반과 함께 결제하면 <span className="font-semibold text-primary">198,000원</span>에 수강 가능합니다.
                </p>
              )}
            </FadeInSection>
          </section>

          {/* ① 수강 일정 선택 (Top) */}
          <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6 sm:pt-16">
            <FadeInSection>
              <h2 className="text-xl font-bold sm:text-2xl md:text-3xl text-white">
                수강 <span className="text-primary">일정</span> 선택
              </h2>
              <p className="mt-2 text-sm text-white sm:text-base">
                밀착 코칭을 위해 클래스당 최대{" "}
                <span className="font-semibold text-primary">{current.maxStudents}명</span> 소수 정예 진행
              </p>
            </FadeInSection>
            <div className="mt-6 sm:mt-8">
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
              <p className="mt-4 text-xs font-medium text-sub-text sm:text-sm">
                📍 수강 장소: 인천타워대로 301 센텀하이브
              </p>
            </div>
          </section>

          {/* ② 이런 분들께 추천해요 */}
          <section className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-20">
            <FadeInSection>
              <h2 className="text-xl font-bold sm:text-2xl md:text-3xl text-white">
                이런 분들께 <span className="text-primary">추천</span>해요
              </h2>
            </FadeInSection>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-3 items-stretch">
              {current.recommendations.map((rec, i) => (
                <FadeInSection key={rec.tag} delay={i * 0.1} className="flex">
                  <div className="flex flex-col justify-center w-full rounded-xl border border-border bg-card px-6 py-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 sm:px-8 sm:py-10">
                    <h3 className="text-lg font-bold text-primary sm:text-xl">
                      {rec.tag}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white sm:mt-3 sm:text-base">
                      {rec.desc}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ③ 세부 커리큘럼 */}
          <section className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-20">
            <FadeInSection>
              <h2 className="text-xl font-bold sm:text-2xl md:text-3xl text-white">
                세부 <span className="text-primary">커리큘럼</span>
              </h2>
            </FadeInSection>
            <div className="mt-6 space-y-4 sm:mt-8">
              {current.curriculum.map((lesson, i) => (
                <FadeInSection key={lesson.period} delay={i * 0.1}>
                  <div className="rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 sm:p-7">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-display text-sm font-bold text-primary sm:text-base">
                          {lesson.period}
                        </span>
                        <h3 className="text-base font-semibold text-white sm:text-lg">{lesson.title}</h3>
                      </div>
                      <span className="font-display text-xs font-medium text-sub-text sm:text-sm sm:text-white">
                        {lesson.duration}
                      </span>
                    </div>
                    {lesson.subtitle && (
                      <p className="mt-2 text-sm text-sub-text">{lesson.subtitle}</p>
                    )}
                    <ul className="mt-4 space-y-2">
                      {lesson.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-white sm:text-base">
                          <span className="mt-0.5 shrink-0 text-primary">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    {lesson.tip && (
                      <p className="mt-4 rounded-lg bg-primary/5 px-4 py-3 text-sm text-primary/90">
                        💡 {lesson.tip}
                      </p>
                    )}
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ④ 수강생 사전 준비물 (아코디언) */}
          <section className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-20">
            <FadeInSection>
              <button
                onClick={() => setPrepOpen(!prepOpen)}
                className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/50 sm:p-7"
              >
                <h2 className="text-lg font-bold text-white sm:text-xl">
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
                    <div className="rounded-b-xl border border-t-0 border-border bg-card px-5 pb-5 pt-3 sm:px-7 sm:pb-7">
                      <ul className="space-y-3">
                        {current.preparation.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-white sm:text-base">
                            <span className="mt-0.5 shrink-0 text-primary">✓</span>
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

          {/* ⑤ 오직 수강생에게만 제공되는 혜택 */}
          <section className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-20">
            <FadeInSection>
              <h2 className="text-xl font-bold sm:text-2xl md:text-3xl text-white">
                🎁 오직 수강생에게만 제공되는{" "}
                <span className="text-primary">혜택 {current.benefitCount}가지</span>
              </h2>
              <p className="mt-3 text-sm text-white sm:text-base">
                {current.benefitsIntro}
              </p>
            </FadeInSection>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2">
              {current.benefits.map((b, i) => (
                <FadeInSection key={b.title} delay={i * 0.1}>
                  <div className="rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 h-full sm:p-7">
                    <div className="flex items-start gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
                        {i + 1}
                      </span>
                      <h3 className="text-base font-bold text-white sm:text-lg">{b.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-white sm:text-base">
                      {b.desc}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ⑥ 이 클래스를 듣고 나면 이렇게 변합니다 */}
          <section className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-20">
            <FadeInSection>
              <h2 className="text-xl font-bold sm:text-2xl md:text-3xl text-white">
                ✨ 이 클래스를 듣고 나면{" "}
                <span className="text-primary">이렇게 변합니다</span>
              </h2>
            </FadeInSection>
            <FadeInSection delay={0.1}>
              <p className="mt-6 text-center text-xl font-bold leading-snug text-primary sm:mt-8 sm:text-2xl md:text-3xl">
                &ldquo;{current.quote}&rdquo;
              </p>
            </FadeInSection>
            <div className="mt-8 space-y-4 sm:mt-10">
              {current.transformations.map((t, i) => (
                <FadeInSection key={i} delay={i * 0.12}>
                  <div className="rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 sm:p-7">
                    <h3 className="text-base font-bold text-primary sm:text-lg">{t.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white sm:text-base">
                      {t.desc}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ⑦ 자주 묻는 질문 (FAQ) */}
          <section className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-20">
            <FadeInSection>
              <h2 className="text-xl font-bold sm:text-2xl md:text-3xl text-white">
                🙋‍♀️ 자주 묻는 <span className="text-primary">질문</span>
              </h2>
            </FadeInSection>
            <div className="mt-6 space-y-3 sm:mt-8">
              {faqs.map((faq, i) => (
                <FadeInSection key={i} delay={i * 0.06}>
                  <FaqItem q={faq.q} a={faq.a} />
                </FadeInSection>
              ))}
            </div>
          </section>

          {/* ⑧ 수강 일정 선택 (Bottom) */}
          <section className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-20">
            <FadeInSection>
              <h2 className="text-xl font-bold sm:text-2xl md:text-3xl text-white">
                수강 <span className="text-primary">일정</span> 선택
              </h2>
              <p className="mt-2 text-sm text-white sm:text-base">
                밀착 코칭을 위해 클래스당 최대{" "}
                <span className="font-semibold text-primary">{current.maxStudents}명</span> 소수 정예 진행
              </p>
            </FadeInSection>
            <div className="mt-6 sm:mt-8">
              {schedulesLoaded && currentSchedules.length > 0 && (
                <ScheduleChips
                  schedules={currentSchedules}
                  selectedSchedule={selectedSchedule}
                  onSelect={setSelectedSchedule}
                />
              )}
              <p className="mt-4 text-xs font-medium text-sub-text sm:text-sm">
                📍 수강 장소: 인천타워대로 301 센텀하이브
              </p>
            </div>
          </section>
        </motion.div>
      </AnimatePresence>

      {/* ─── Sticky Checkout Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          {/* 선택 내역 + 금액 */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-white sm:text-base">
              {current.icon} {current.label}
              {selectedScheduleLabel && (
                <>
                  <span className="mx-1.5 text-border">|</span>
                  <span className="font-semibold text-white">{selectedScheduleLabel}</span>
                </>
              )}
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 sm:mt-1 sm:gap-x-2">
              <span className="font-display text-xs text-sub-text line-through sm:text-base">
                {current.originalPrice.toLocaleString("ko-KR")}원
              </span>
              {isIntermediateDiscount ? (
                <>
                  <span className="font-display text-xs text-sub-text line-through sm:text-sm">
                    {current.salePrice.toLocaleString("ko-KR")}원
                  </span>
                  <span className="font-display text-base font-bold text-primary sm:text-xl">
                    {finalPrice.toLocaleString("ko-KR")}원
                  </span>
                </>
              ) : (
                <span className="font-display text-base font-bold text-primary sm:text-xl">
                  {current.salePrice.toLocaleString("ko-KR")}원
                </span>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <button
            onClick={handleCheckout}
            className="shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 sm:px-8 sm:py-4 sm:text-lg"
          >
            수강 신청
          </button>
        </div>
      </div>
    </div>
  );
}

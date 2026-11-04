/**
 * /production 랜딩페이지 설정 파일
 *
 * 코드를 몰라도 이 파일의 값만 고치면 페이지에 바로 반영됩니다.
 * - 가격이 빈 문자열("")이면 화면에는 "상담 후 안내"로 표시됩니다.
 * - kakaoChannelUrl 이 비어 있으면 카카오톡 버튼이 숨겨집니다.
 * - samples 배열이 비어 있으면 샘플 섹션 자체가 숨겨집니다.
 */

/* ── 가격 ───────────────────────────────────────────── */

export const pricing = {
  /** 기획 진단 가격 (예: "10만원"). 비우면 "상담 후 안내" */
  diagnosisPrice: "10만원",
  /** 계약 시 진단 비용 차감 여부 안내 문구. 비우면 표시 안 함 (예: "계약 시 전액 차감") */
  diagnosisCredit: "계약 시 전액 차감",

  /** 패키지별 가격 (예: "월 180만원"). 비우면 "상담 후 안내" */
  basicPrice: "월 120만원",
  standardPrice: "월 200만원",
  premiumPrice: "월 450만원",

  /** "부가세 별도" 표기 여부 */
  showVatNote: true,
  vatNote: "모든 금액은 부가세 별도입니다.",

  /** 최소 계약 기간 (개월). 0이면 FAQ에서 "상담 시 안내"로 표시 */
  minContractMonths: 0,
};

/**
 * 장기 계약 할인 — 월 단위 계약이 기본이고, N개월 이상 약정 시 월 요금을 할인.
 * rate 를 비우면 해당 구간은 표시되지 않고, 전부 비면 할인 안내 자체가 숨겨집니다.
 * 예: { months: 3, rate: "10%" }, { months: 6, rate: "15%" }
 * (할인은 월 패키지에만 적용 — 기획 진단은 제외)
 */
export const longTermDiscounts: { months: number; rate: string }[] = [
  { months: 3, rate: "10%" },
  { months: 6, rate: "15%" },
];

/** 패키지별 포함/불포함 항목 */
export const packages = [
  {
    id: "diagnosis",
    name: "기획 진단",
    summary: "30분 온라인 상담 + 진단 리포트 1장",
    priceKey: "diagnosisPrice" as const,
    recommended: false,
    includes: [
      "지금 상황·목표 정리 (온라인 30분)",
      "찍을 주제 방향 제안",
      "첫 달 계획 초안",
      "진단 리포트 1장 (PDF)",
    ],
    excludes: [] as string[],
  },
  {
    id: "basic",
    name: "베이직",
    summary: "월 2편 · 기획·촬영·편집",
    priceKey: "basicPrice" as const,
    recommended: false,
    includes: [
      "월 2편 기획·촬영·편집",
      "제목·썸네일·자막 포함",
      "편당 수정 2회",
    ],
    excludes: ["쇼츠 제작", "채널 아트 디자인"],
  },
  {
    id: "standard",
    name: "스탠다드",
    summary: "월 4편 + 쇼츠 8편",
    priceKey: "standardPrice" as const,
    recommended: true,
    includes: [
      "월 4편 기획·촬영·편집",
      "쇼츠 8편 추가 제작",
      "제목·썸네일·자막 포함",
      "반나절 촬영 (월 1회 방문)",
      "편당 수정 2회",
    ],
    excludes: [] as string[],
  },
  {
    id: "premium",
    name: "프리미엄",
    summary: "월 8편 + 쇼츠 16편",
    priceKey: "premiumPrice" as const,
    recommended: false,
    includes: [
      "월 8편 기획·촬영·편집",
      "쇼츠 16편 추가 제작",
      "제목·썸네일·자막 포함",
      "반나절 촬영 (월 2회 방문)",
      "편당 수정 2회",
    ],
    excludes: [] as string[],
  },
];

/** 신청 폼의 "월 예산 범위" 선택지 */
export const budgetRanges = [
  "월 100만원 미만",
  "월 100~200만원",
  "월 200~300만원",
  "월 300만원 이상",
  "아직 모르겠어요",
];

/* ── 연락 채널 ──────────────────────────────────────── */

export const contact = {
  /** 카카오톡 채널 URL (예: "https://pf.kakao.com/_xxxx/chat"). 비우면 버튼 숨김 */
  kakaoChannelUrl: "https://open.kakao.com/o/sPXD8wVi",
  email: "untitled.mooje@gmail.com",
  instagramUrl: "https://www.instagram.com/untitled______projects/",
};

/* ── 개인정보 ──────────────────────────────────────── */

export const privacy = {
  /** 개인정보 보유 기간 (년) */
  retentionYears: 1,
};

/* ── 숫자 지표 (ABOUT 섹션) ─────────────────────────── */
/** value 를 비우면 해당 지표는 숨겨집니다. 전부 비면 지표 영역 전체가 숨겨집니다. */
export const stats: { value: string; label: string }[] = [
  { value: "1,000편+", label: "누적 영상 제작" },
  { value: "100만+", label: "운영 채널 누적 구독자" },
  { value: "1,000만+", label: "누적 영상 조회수" },
  { value: "8년", label: "영상 제작 경력" },
];

/* ── 샘플 (비어 있으면 섹션 숨김) ────────────────────── */

export interface SampleItem {
  /** pilot: 파일럿 영상 / demo: 데모 영상(배지 표시) / plan: 기획안 샘플 */
  type: "pilot" | "demo" | "plan";
  title: string;
  description?: string;
  /** 유튜브 영상 URL (pilot/demo) */
  youtubeUrl?: string;
  /** 기획안 PDF 또는 이미지 경로 (plan) */
  fileUrl?: string;
}

export const samples: SampleItem[] = [];

/* ── 케이스 스터디 (비어 있으면 섹션 숨김) ─────────────── */

export interface CaseItem {
  client: string;
  channel: string;
  summary: string;
  growth: string;
  before: string;
  action: string;
  after: string;
}

/**
 * 비어 있으면 WORK 섹션이 통째로 숨겨집니다.
 * 공개 가능한 사례가 생기면 아래 형식으로 추가하세요. (지어낸 수치·사례 금지)
 *
 * {
 *   client: "OO정형외과",
 *   channel: "채널명",
 *   summary: "신규 런칭부터 월간 포맷 운영까지",
 *   growth: "구독자 0 → N명",
 *   before: "채널 자산이 없는 상태에서 시작",
 *   action: "타깃 질문 기반 주제 선정, 롱폼·쇼츠 분리 운영",
 *   after: "N개월 만에 구독자 N명",
 * }
 */
export const cases: CaseItem[] = [];

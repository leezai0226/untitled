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
  diagnosisPrice: "",
  /** 계약 시 진단 비용 차감 여부 안내 문구. 비우면 표시 안 함 (예: "계약 시 전액 차감") */
  diagnosisCredit: "",

  /** 패키지별 가격 (예: "월 180만원"). 비우면 "상담 후 안내" */
  basicPrice: "",
  standardPrice: "",
  premiumPrice: "",

  /** "부가세 별도" 표기 여부 */
  showVatNote: true,
  vatNote: "모든 금액은 부가세 별도입니다.",

  /** 최소 계약 기간 (개월). 0이면 FAQ에서 "상담 시 안내"로 표시 */
  minContractMonths: 0,
};

/** 패키지별 포함/불포함 항목 */
export const packages = [
  {
    id: "diagnosis",
    name: "기획 진단",
    summary: "30분 상담 + 진단 리포트 1장",
    priceKey: "diagnosisPrice" as const,
    recommended: false,
    includes: [
      "지금 상황·목표 정리 (온라인 또는 방문)",
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
    summary: "월 4편 · 기획·촬영·편집",
    priceKey: "standardPrice" as const,
    recommended: true,
    includes: [
      "월 4편 기획·촬영·편집",
      "제목·썸네일·자막 포함",
      "반나절 몰아 찍기 (월 1회 방문)",
      "편당 수정 2회",
    ],
    excludes: ["쇼츠 제작"],
  },
  {
    id: "premium",
    name: "프리미엄",
    summary: "월 4편 + 쇼츠 4편",
    priceKey: "premiumPrice" as const,
    recommended: false,
    includes: [
      "월 4편 기획·촬영·편집",
      "쇼츠 4편 추가 제작",
      "제목·썸네일·자막 포함",
      "반나절 몰아 찍기 (월 1회 방문)",
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
  kakaoChannelUrl: "",
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
/** ⚠️ 아래 "N개사", "000,000" 등은 자리표시 값입니다 — 실제 수치로 교체하거나 비워 주세요. */
export const stats: { value: string; label: string }[] = [
  { value: "N개사", label: "현재 파트너" },
  { value: "000,000", label: "운영 채널 누적 구독자" },
  { value: "0,000만+", label: "누적 영상 조회수" },
  { value: "2016—현재", label: "영상 제작 경력" },
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

/** ⚠️ 아래는 자리표시 사례입니다 — 실제 공개 가능한 사례로 교체하세요. 비어 있으면 WORK 섹션이 숨겨집니다. */
export const cases: CaseItem[] = [
  {
    client: "채널 A (교체 필요)",
    channel: "채널명",
    summary: "신규 런칭부터 월간 포맷 운영까지",
    growth: "구독자 0 → 000명",
    before: "채널 자산이 없는 상태에서 시작",
    action: "타깃 질문 기반 주제 선정, 롱폼·쇼츠 분리 운영",
    after: "신규 채널 기준 구독자 000명까지 성장",
  },
  {
    client: "채널 B (교체 필요)",
    channel: "채널명",
    summary: "기존 채널 리빌딩과 검색 유입 구조 재정비",
    growth: "구독자 000 → 0.0천명",
    before: "업로드는 있었지만 검색 유입과 전환 흐름이 약한 상태",
    action: "콘텐츠 주제 구조화, 시청자 질문 중심으로 재정비",
    after: "구독자 0.0천명 도달, 최고 조회수 00만회 기록",
  },
  {
    client: "채널 C (교체 필요)",
    channel: "채널명",
    summary: "장기 운영 기준 수립과 포맷 구조화",
    growth: "구독자 0.0천 → 00.0만",
    before: "영상은 있었지만 장기 운영 기준이 필요한 상태",
    action: "검색 질문·전문성·전환 안내를 연결하는 운영 설계",
    after: "구독자 00.0만 성장, 단일 영상 최고 000만회 기록",
  },
];

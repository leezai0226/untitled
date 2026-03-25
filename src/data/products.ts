export interface Product {
  id: string;
  title: string;
  price: number;
  category: "컬러 프리셋" | "자막 템플릿" | "효과음/BGM" | "Free";
  description: string;
  thumbnail_url: string | null;
  detail_images: string[];
  file_url: string | null;
  format: string;
}

export const CATEGORIES = ["전체", "컬러 프리셋", "자막 템플릿", "효과음/BGM", "Free"] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * 임시 상품 목록 — 추후 Supabase Products 테이블로 교체 예정
 */
export const products: Product[] = [
  {
    id: "cinematic-color-preset",
    title: "시네마틱 컬러 프리셋 팩",
    price: 29000,
    category: "컬러 프리셋",
    description:
      "영화 같은 색감을 한 번에. Lumetri 프리셋 10종 세트로, 드래그 앤 드롭만으로 시네마틱 무드를 완성합니다. 따뜻한 빈티지부터 차가운 사이버톤까지 다양한 무드를 한 팩에 담았습니다.",
    thumbnail_url: null,
    detail_images: [],
    file_url: null,
    format: ".cube / .prfpset",
  },
  {
    id: "warm-tone-preset",
    title: "웜톤 감성 프리셋 팩",
    price: 19000,
    category: "컬러 프리셋",
    description:
      "따뜻하고 부드러운 색감의 Lumetri 프리셋 8종. 일상 브이로그, 카페 영상, 여행 영상에 입히면 감성이 두 배가 됩니다.",
    thumbnail_url: null,
    detail_images: [],
    file_url: null,
    format: ".cube / .prfpset",
  },
  {
    id: "modern-subtitle-template",
    title: "모던 자막 템플릿",
    price: 19000,
    category: "자막 템플릿",
    description:
      "유튜브, 인스타 릴스에 바로 쓸 수 있는 깔끔한 자막 모션 그래픽 템플릿 8종입니다. 프리미어 프로에서 텍스트만 바꾸면 바로 적용 가능합니다.",
    thumbnail_url: null,
    detail_images: [],
    file_url: null,
    format: ".mogrt",
  },
  {
    id: "vlog-subtitle-pack",
    title: "감성 브이로그 자막 팩 Vol.1",
    price: 15000,
    category: "자막 템플릿",
    description:
      "브이로그 감성에 딱 맞는 손글씨 스타일 자막 템플릿 6종. 영상에 따뜻한 감성을 더해줍니다. Mogrt 파일로 드래그 앤 드롭 적용.",
    thumbnail_url: null,
    detail_images: [],
    file_url: null,
    format: ".mogrt",
  },
  {
    id: "vlog-bgm-pack",
    title: "브이로그 BGM 팩",
    price: 15000,
    category: "효과음/BGM",
    description:
      "따뜻한 감성의 로파이, 어쿠스틱 BGM 5곡. 저작권 걱정 없이 자유롭게 사용하세요. 유튜브, 인스타 릴스 등 어디에든 상업적 이용 가능합니다.",
    thumbnail_url: null,
    detail_images: [],
    file_url: null,
    format: ".wav / .mp3",
  },
  {
    id: "sfx-effect-pack",
    title: "트렌디 효과음(SFX) 팩 50",
    price: 22000,
    category: "효과음/BGM",
    description:
      "영상의 맛을 확 살려주는 효과음 모음집 50가지. 우쉬, 팝, 글리치, 타이핑 등 숏폼에서 자주 쓰이는 사운드를 한 팩에 모았습니다.",
    thumbnail_url: null,
    detail_images: [],
    file_url: null,
    format: ".wav",
  },
  {
    id: "free-lut-sample",
    title: "무료 시네마틱 LUT 샘플 3종",
    price: 0,
    category: "Free",
    description:
      "시네마틱 컬러 프리셋 팩에서 엄선한 LUT 3종을 무료로 체험해 보세요. 적용만으로 영상 색감이 확 달라지는 걸 직접 느껴보실 수 있습니다.",
    thumbnail_url: null,
    detail_images: [],
    file_url: "/downloads/free-lut-sample.zip",
    format: ".cube",
  },
  {
    id: "free-sfx-starter",
    title: "무료 효과음 스타터 팩",
    price: 0,
    category: "Free",
    description:
      "숏폼 편집에 바로 쓸 수 있는 효과음 5가지를 무료로 드립니다. 우쉬, 팝, 스위시 등 가장 자주 쓰이는 사운드만 모았습니다.",
    thumbnail_url: null,
    detail_images: [],
    file_url: "/downloads/free-sfx-starter.zip",
    format: ".wav",
  },
];

export function isFreeProduct(product: Product): boolean {
  return product.price === 0;
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function formatPrice(price: number): string {
  if (price === 0) return "무료 (Free)";
  return `₩${price.toLocaleString("ko-KR")}`;
}

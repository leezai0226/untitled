import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { contact, packages, pricing } from "@/config/production";
import { buildFaqs } from "@/components/production/faqData";

/**
 * /production 메타데이터 + 검색엔진용 구조화 데이터(JSON-LD).
 * 네이버·구글 검색 결과에 제목·설명·FAQ 가 올바르게 노출되도록 한다.
 * 가격·FAQ 는 config 에서 읽으므로 값이 바뀌면 자동 반영.
 */

const TITLE = "병원·변호사 유튜브 제작·운영 | UNTITLED PRODUCTION";
const DESCRIPTION =
  "개원의·변호사를 위한 유튜브 제작·운영 서비스. 기획부터 촬영, 편집, 업로드까지 한 팀이 맡습니다. 원장님·변호사님이 쓰시는 시간은 한 달에 반나절이면 됩니다.";
const PAGE_URL = `${SITE_URL}/production`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "병원 유튜브",
    "의사 유튜브",
    "변호사 유튜브",
    "전문직 유튜브",
    "유튜브 제작 대행",
    "유튜브 운영 대행",
    "병원 마케팅",
    "로펌 마케팅",
    "병원 유튜브 제작",
    "변호사 유튜브 제작",
  ],
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description:
      "영상을 못 하시는 게 아니라, 어떻게 시작할지 모르셨던 겁니다. 기획·촬영·편집·업로드까지 한 팀이 맡습니다.",
    url: PAGE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/** 가격 문자열("월 120만원") → 숫자(원). 파싱 불가하면 undefined */
function priceToKrw(label: string): number | undefined {
  const m = label.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*만원/);
  return m ? Math.round(parseFloat(m[1]) * 10_000) : undefined;
}

function buildJsonLd() {
  const faqs = buildFaqs();

  const offers = packages
    .map((pkg) => {
      const price = priceToKrw(pricing[pkg.priceKey]);
      if (!price) return null;
      return {
        "@type": "Offer",
        name: pkg.name,
        description: pkg.summary,
        price,
        priceCurrency: "KRW",
        url: `${PAGE_URL}#pricing`,
      };
    })
    .filter(Boolean);

  return [
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "UNTITLED PRODUCTION",
      alternateName: SITE_NAME,
      url: PAGE_URL,
      email: contact.email,
      sameAs: [contact.instagramUrl].filter(Boolean),
      areaServed: { "@type": "Country", name: "KR" },
      description: DESCRIPTION,
      makesOffer: offers,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "병원·변호사 유튜브 제작·운영",
      serviceType: "유튜브 채널 기획·제작·운영 대행",
      provider: { "@type": "Organization", name: "UNTITLED PRODUCTION", url: SITE_URL },
      audience: {
        "@type": "Audience",
        audienceType: "개원의, 변호사, 전문직",
      },
      areaServed: { "@type": "Country", name: "KR" },
      url: PAGE_URL,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = buildJsonLd();
  return (
    <>
      {jsonLd.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      {children}
    </>
  );
}

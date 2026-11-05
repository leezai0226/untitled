import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_URL, SITE_NAME } from "@/lib/site";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const isProduction = process.env.NODE_ENV === "production";

/** 검색엔진 사이트 소유 확인 코드 — Vercel 환경변수로 주입 (없으면 태그 생략) */
const NAVER_VERIFICATION = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION;
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description:
    "초보자를 위한 프리미어 프로 영상 편집 원데이 클래스 & 디지털 에셋 스토어",
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  verification: {
    ...(GOOGLE_VERIFICATION ? { google: GOOGLE_VERIFICATION } : {}),
    ...(NAVER_VERIFICATION
      ? { other: { "naver-site-verification": NAVER_VERIFICATION } }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        {/* 포트원 V1 (구 아임포트) 결제 SDK */}
        <script src="https://cdn.iamport.kr/v1/iamport.js" defer />
      </head>
      <body className={`${montserrat.variable} antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
      {isProduction && GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}

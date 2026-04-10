import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const isProduction = process.env.NODE_ENV === "production";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "프리미어 프로 원데이 클래스",
  description:
    "초보자를 위한 프리미어 프로 영상 편집 원데이 클래스 & 디지털 에셋 스토어",
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

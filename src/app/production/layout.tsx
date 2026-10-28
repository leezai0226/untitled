import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "병원·변호사 유튜브 제작·운영 | UNTITLED PRODUCTION",
  description:
    "개원의·변호사를 위한 유튜브 제작·운영 서비스. 기획부터 촬영, 편집, 업로드까지 한 팀이 맡습니다. 원장님·변호사님이 쓰시는 시간은 한 달에 반나절이면 됩니다.",
  keywords: [
    "병원 유튜브",
    "의사 유튜브",
    "변호사 유튜브",
    "전문직 유튜브",
    "유튜브 제작 대행",
    "유튜브 운영 대행",
    "병원 마케팅",
    "로펌 마케팅",
  ],
  openGraph: {
    title: "병원·변호사 유튜브 제작·운영 | UNTITLED PRODUCTION",
    description:
      "영상을 못 하시는 게 아니라, 어떻게 시작할지 모르셨던 겁니다. 기획·촬영·편집·업로드까지 한 팀이 맡습니다.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

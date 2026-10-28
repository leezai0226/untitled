import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import ChecklistForm from "@/components/production/ChecklistForm";

export const metadata: Metadata = {
  title: "유튜브 시작 체크리스트 | UNTITLED PRODUCTION",
  description:
    "병원·법률 전문직을 위한 유튜브 시작 체크리스트. 첫 영상을 올리기 전에 꼭 확인해야 할 것들을 정리했습니다.",
};

/**
 * /checklist — 스레드 연동용 체크리스트 다운로드 페이지.
 * public/checklist.pdf 가 있으면 제출 후 다운로드, 없으면 "준비 중" 표시.
 */
export default function ChecklistPage() {
  const pdfReady = fs.existsSync(
    path.join(process.cwd(), "public", "checklist.pdf")
  );

  return <ChecklistForm pdfReady={pdfReady} />;
}

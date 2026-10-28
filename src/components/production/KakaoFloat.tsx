"use client";

import { contact } from "@/config/production";

/**
 * 모바일 하단 고정 카카오톡 채널 플로팅 버튼.
 * kakaoChannelUrl 이 비어 있으면 렌더링하지 않는다.
 */
export default function KakaoFloat() {
  if (!contact.kakaoChannelUrl.trim()) return null;

  return (
    <a
      href={contact.kakaoChannelUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="카카오톡 채널로 문의하기"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#FEE500] px-5 py-3.5 text-sm font-bold text-[#191919] shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 md:bottom-8 md:right-8"
    >
      💬 <span>카톡 문의</span>
    </a>
  );
}

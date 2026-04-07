import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="pt-20 pb-20">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* 헤더 */}
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          개인정보<span className="text-primary">처리방침</span>
        </h1>
        <p className="mt-3 text-sm text-sub-text">
          최종 수정일: 2025년 3월 24일
        </p>

        <p className="mt-8 text-base leading-relaxed text-sub-text">
          &lsquo;스튜디오 무제&rsquo;은 이용자의 개인정보를 중요시하며, 관련
          법령을 준수합니다.
        </p>

        <div className="mt-12 space-y-8">
          {/* 1. 수집 항목 */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-primary">
              1. 수집하는 개인정보 항목
            </h2>
            <ul className="mt-4 space-y-2 text-base text-sub-text">
              {[
                "성명",
                "이메일 주소",
                "휴대전화 번호",
                "결제 정보 (KG이니시스 연동)",
                "접속 기록",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 2. 수집 목적 */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-primary">
              2. 수집 및 이용 목적
            </h2>
            <ul className="mt-4 space-y-2 text-base text-sub-text">
              {[
                "디지털 에셋 제공",
                "오프라인 클래스 참석자 본인 확인",
                "CS 문의 대응",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 3. 보유 기간 */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-primary">
              3. 보유 및 이용 기간
            </h2>
            <ul className="mt-4 space-y-2 text-base text-sub-text">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">•</span>
                <span>
                  대금 결제 및 재화 공급 기록:{" "}
                  <span className="text-white font-medium">5년</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">•</span>
                <span>
                  소비자 불만 처리 기록:{" "}
                  <span className="text-white font-medium">3년</span>
                </span>
              </li>
            </ul>
          </section>

          {/* 4. 위탁 */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-primary">
              4. 개인정보의 위탁
            </h2>
            <p className="mt-4 text-base text-sub-text">
              <span className="text-white font-medium">
                KG이니시스
              </span>{" "}
              — 전자결제 처리
            </p>
          </section>

          {/* 5. 관리 책임자 */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-primary">
              5. 개인정보 관리 책임자
            </h2>
            <div className="mt-4 space-y-1 text-base text-sub-text">
              <p>
                담당자:{" "}
                <span className="text-white font-medium">이영재</span>
              </p>
              <p>
                이메일:{" "}
                <a
                  href="mailto:untitled.mooje@gmail.com"
                  className="text-primary transition-colors hover:brightness-110"
                >
                  untitled.mooje@gmail.com
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* 하단 네비 */}
        <div className="mt-16 flex items-center justify-between border-t border-border pt-8">
          <Link
            href="/terms"
            className="text-sm text-sub-text transition-colors hover:text-primary"
          >
            ← 이용약관
          </Link>
          <Link
            href="/"
            className="text-sm text-sub-text transition-colors hover:text-primary"
          >
            홈으로 →
          </Link>
        </div>
      </div>
    </div>
  );
}

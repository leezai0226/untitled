import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="pt-20 pb-20">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* 헤더 */}
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          이용<span className="text-primary">약관</span>
        </h1>
        <p className="mt-3 text-sm text-sub-text">
          최종 수정일: 2025년 3월 24일
        </p>

        <div className="mt-12 space-y-12">
          {/* 제1조 */}
          <section>
            <h2 className="text-xl font-bold text-white">제1조 (목적)</h2>
            <p className="mt-4 text-base leading-relaxed text-sub-text">
              본 약관은 &lsquo;스튜디오 무제&rsquo; (이하 &ldquo;회사&rdquo;)이
              운영하는 웹사이트에서 제공하는 디지털 콘텐츠 판매 및 오프라인 영상
              편집 클래스 예약 서비스를 이용함에 있어 회사와 이용자의 권리, 의무 및
              책임 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-xl font-bold text-white">
              제2조 (서비스의 제공)
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-base leading-relaxed text-sub-text">
              <li>
                회사는 결제가 완료된 이용자에게 디지털 에셋 다운로드 권한을
                부여하거나, 지정된 일자의 오프라인 클래스 수강 권한을 제공합니다.
              </li>
              <li>
                오프라인 클래스는{" "}
                <span className="text-white font-medium">
                  인천타워대로 301 센텀하이브
                </span>
                에서 진행됩니다.
              </li>
            </ol>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-xl font-bold text-white">
              제3조 (지식재산권 및 이용 제한)
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-base leading-relaxed text-sub-text">
              <li>
                회사가 제공하는 모든 디지털 파일 및 클래스 교육 자료의 저작권은
                회사에 있습니다.
              </li>
              <li>
                이용자는 구매한 디지털 파일을 본인의 영상 제작 목적으로만 사용할
                수 있으며,{" "}
                <span className="text-white font-medium">
                  무단 배포나 재판매는 엄격히 금지
                </span>
                됩니다.
              </li>
            </ol>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-xl font-bold text-white">
              제4조 (청약철회 및 환불 규정)
            </h2>
            <div className="mt-4 space-y-5">
              {/* 디지털 에셋 */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-base font-bold text-primary">
                  디지털 에셋
                </h3>
                <p className="mt-3 text-base leading-relaxed text-sub-text">
                  파일 다운로드 이력이 있는 경우에는 청약철회 및 환불이
                  불가합니다. 다운로드하지 않은 상태에서는{" "}
                  <span className="text-white font-medium">
                    결제일로부터 7일 이내
                  </span>
                  에 환불이 가능합니다.
                </p>
              </div>

              {/* 오프라인 클래스 */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-base font-bold text-primary">
                  오프라인 클래스
                </h3>
                <ul className="mt-3 space-y-2 text-base text-sub-text">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-400">●</span>
                    <span>
                      클래스 진행일{" "}
                      <span className="text-white font-medium">7일 전</span>
                      까지:{" "}
                      <span className="text-white font-medium">100% 환불</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-yellow-400">●</span>
                    <span>
                      클래스 진행일{" "}
                      <span className="text-white font-medium">5일 전</span>
                      까지: 결제 금액의{" "}
                      <span className="text-white font-medium">50% 환불</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-red-400">●</span>
                    <span>
                      클래스{" "}
                      <span className="text-white font-medium">
                        4일 이내
                      </span>
                      : 환불 불가
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-xl font-bold text-white">
              제5조 (결제 및 취소)
            </h2>
            <p className="mt-4 text-base leading-relaxed text-sub-text">
              결제는 KG이니시스를 통한 전자결제 대행 서비스를 이용합니다.
            </p>
          </section>
        </div>

        {/* 하단 네비 */}
        <div className="mt-16 flex items-center justify-between border-t border-border pt-8">
          <Link
            href="/"
            className="text-sm text-sub-text transition-colors hover:text-primary"
          >
            ← 홈으로
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-sub-text transition-colors hover:text-primary"
          >
            개인정보처리방침 →
          </Link>
        </div>
      </div>
    </div>
  );
}

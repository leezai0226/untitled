import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <Link href="/" className="font-display text-xl font-bold tracking-tight">
              <span className="text-primary">UNTITLED</span>PROJECTS
            </Link>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3">
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-sub-text">
              Menu
            </h4>
            <Link href="/class" className="text-sm text-sub-text transition-colors hover:text-primary">
              Class
            </Link>
            <Link href="/shop" className="text-sm text-sub-text transition-colors hover:text-primary">
              Store
            </Link>
            <Link href="/mypage" className="text-sm text-sub-text transition-colors hover:text-primary">
              My Page
            </Link>
          </div>

          {/* SNS */}
          <div className="flex flex-col gap-3">
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-sub-text">
              SNS
            </h4>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/untitled______projects/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-sub-text transition-colors hover:text-primary"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>

        {/* 사업자 정보 */}
        <div className="mt-10 border-t border-border pt-6">
          <div className="text-xs leading-relaxed text-gray-500 space-y-1">
            <p>
              사업자등록번호: 457-11-02461 &nbsp;&nbsp;&nbsp;
              통신판매업신고번호 :
            </p>
            <p>
              대표: 이영재 &nbsp;&nbsp;&nbsp;
              주소: 인천광역시 연수구 인천타워대로 301 센텀하이브 A동 3936호
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-gray-500">
              &copy; Corp.
            </p>
            <div className="flex gap-1 text-xs text-gray-500">
              <Link
                href="/terms"
                className="hover:text-primary hover:underline transition-colors"
              >
                이용약관
              </Link>
              <span className="text-gray-600">|</span>
              <Link
                href="/privacy"
                className="hover:text-primary hover:underline transition-colors"
              >
                개인정보처리방침
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

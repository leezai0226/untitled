# 🎬 프리미어 프로 원데이 클래스 & 디지털 상점 웹사이트 기획서

## 1. 프로젝트 개요 (Project Overview)
- **목적:** 초보자를 위한 프리미어 프로 영상 편집 원데이 클래스 수강 신청 및 디지털 에셋(프리셋, 템플릿 등) 판매
- **타겟 고객:** 영상 편집을 처음 시작하는 입문자, 완벽주의를 버리고 꾸준하게 숏폼/브이로그를 만들고 싶은 크리에이터
- **핵심 가치 제안:** 현업 필름메이커의 실무 노하우, 100일 릴스 챌린지처럼 당장 실행할 수 있는 실전 압축 커리큘럼 제공

## 2. 기술 스택 (Tech Stack)
- **Front-end:** Next.js (App Router), Tailwind CSS, Framer Motion
- **Back-end & DB & Auth:** Supabase
- **Payment:** Toss Payments (토스페이먼츠 위젯 SDK)
- **Deployment:** Vercel

## 3. 디자인 시스템 (Design System)
이 프로젝트는 아래의 디자인 규칙을 `tailwind.config.js` 및 전역 CSS에 반드시 우선 적용해야 합니다.
- **Color Palette:**
  - Background: `#111111` (다크 그레이 - 눈이 편안한 편집 프로그램 환경 테마)
  - Primary/Point: `#9999FF` (보라색 - 프리미어 프로의 상징적 컬러)
  - Text: `#FFFFFF` (기본 텍스트), `#A1A1AA` (서브 텍스트)
- **Typography:**
  - Base Font: `Pretendard` (한글)
  - Point/Number Font: `Montserrat` (영문/숫자)
- **UI/UX & Animation:**
  - 모든 컴포넌트(버튼, 카드 등)는 모서리를 둥글게(`rounded-xl`) 처리.
  - 마우스 호버(Hover) 시 부드러운 색상 전환 및 떠오르는 효과 적용.
  - `framer-motion`을 활용하여 스크롤 시 섹션별로 부드럽게 나타나는(Fade-in & Slide-up) 애니메이션 필수 적용.
- **Responsive Web:**
  - Mobile-first 접근. `sm:`, `md:`, `lg:` 브레이크포인트를 활용하여 모바일, 태블릿, 데스크톱 해상도에 완벽하게 대응.

## 4. 페이지 구성 (Page Structure)
### 공통 레이아웃
- **Header:** 로고, 네비게이션(class | shop | 마이페이지), 로그인 버튼. (모바일 해상도에서는 햄버거 메뉴로 전환)
- **Footer:** 사업자 정보, SNS 링크, 이용약관 등

### 4.1. 메인 페이지 (/)
- **Hero Section:** 시선을 끄는 메인 카피와 CTA 버튼(`강의 자세히 보기`), 배경은 영상/이미지 플레이스홀더 구성.
- **Value Proposition:** 완벽주의 타파, 직관적인 컷편집 등 3가지 핵심 소구점.
- **Reviews/Portfolio:** 결과물 예시를 보여주는 갤러리 또는 슬라이더.

### 4.2. 강의 구매 상세 페이지 (/class)
- **Hero:** 강의 썸네일, 타이틀(프리미어 프로 입문 원데이 클래스), 난이도, 진행 방식.
- **Sticky Checkout Bar:** 스크롤 시 하단/우측에 고정되는 결제 금액 및 `수강 신청하기` 버튼.
- **Curriculum:** 1부(기초 세팅/컷편집) - 2부(자막/트랜지션) - 3부(BGM/출력) 상세 안내.
- **Payment Widget:** 토스페이먼츠 결제 UI 렌더링 영역.

### 4.3. 제품 구매 페이지 (/shop)
- **Hero:** 디지털 크리에이터 툴킷 소개 카피.
- **Product Grid:** 썸네일, 상품명(예: 컬러 프리셋 팩, 자막 템플릿), 가격, `장바구니` 아이콘이 포함된 카드형 UI.
- **Product Modal:** 카드 클릭 시 상세 설명(사용법, 파일 확장자 등) 및 `구매하기` 버튼 제공.

## 5. 데이터베이스 스키마 (Supabase)
다음 3개의 테이블을 기준으로 백엔드를 구성합니다.
1. **Users:** `id`(UUID), `email`, `name`, `provider`(소셜로그인 출처), `created_at`
2. **Products:** `id`(UUID), `title`, `type`(class/digital_asset), `price`, `thumbnail_url`, `file_url`
3. **Orders:** `id`(UUID), `user_id`, `product_id`, `status`(pending/completed), `paid_at`

## 6. AI 개발 진행 단계 (Roadmap)
이 문서를 읽은 AI는 다음 순서대로 작업을 진행하며, 각 단계가 끝날 때마다 사용자에게 확인을 받습니다.
- **Step 1:** Next.js 초기 세팅 및 [3. 디자인 시스템] 적용 (Tailwind, Font, Framer Motion 설정)
- **Step 2:** 공통 Layout(Header, Footer) 및 3개 주요 페이지(/, /class, /shop) UI 뼈대 퍼블리싱 (반응형 필수)
- **Step 3:** Supabase 패키지 설치 및 소셜 로그인(카카오, 네이버) 연동, DB 테이블(schema.sql) 생성
- **Step 4:** 토스페이먼츠 위젯 SDK 설치 및 /class 페이지 내 테스트 결제 연동
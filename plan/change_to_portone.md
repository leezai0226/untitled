# 결제 시스템을 포트원(PortOne V1)으로 전면 교체 요청

기존 결제 로직을 걷어내고, 내가 이미 발급받은 **포트원 V1 (구 아임포트)** 결제 연동으로 시스템을 전면 교체해 줘.

## 1. 환경 변수 세팅
- 포트원 V1 연동을 위해 `.env.local`에 아래 3개의 환경 변수 구조를 세팅해 줘.
  - `NEXT_PUBLIC_IMP_UID` (가맹점 식별코드, imp_ 로 시작)
  - `PORTONE_API_KEY` (REST API 키)
  - `PORTONE_API_SECRET` (REST API Secret)

## 2. 프론트엔드: V1 SDK 추가 및 결제창 호출 로직
- 결제가 일어나는 페이지에 포트원 V1 브라우저 SDK(`<script src="https://cdn.iamport.kr/v1/iamport.js"></script>`)를 로드해 줘.
- '결제하기' 버튼을 누르면 `IMP.init(process.env.NEXT_PUBLIC_IMP_UID)`로 초기화한 뒤, `IMP.request_pay()` 함수를 호출하여 결제창을 띄우는 로직을 작성해 줘.
- pg사는 'html5_inicis' 등 기본값으로 설정하고, 고유 주문번호(`merchant_uid`), 상품명(`name`), 금액(`amount`) 등을 필수로 전달해 줘.

## 3. 백엔드: 결제 사후 검증(Verify) 로직 (`/app/api/portone/verify/route.ts`)
- 프론트에서 결제 완료 후 반환받은 `imp_uid`와 `merchant_uid`를 이 API로 보내서 결제 위변조 검증을 수행해 줘.
- 포트원 V1 REST API(`https://api.iamport.kr/users/getToken`)로 토큰을 발급받은 뒤, `https://api.iamport.kr/payments/${imp_uid}`를 조회하여 실제 결제 금액을 가져와 줘.
- DB(Supabase)에 저장된 가격과 일치하면 `Orders` 테이블을 'completed'로 바꾸고, 클래스의 경우 `class_schedules`의 `remaining_seats`를 1 차감해 줘.
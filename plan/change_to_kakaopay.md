# 토스페이먼츠 결제 시스템을 '카카오페이 단건 결제 API'로 전면 교체 요청

초기 비용(가입비/연회비) 문제로 인해, 기존에 구현된 토스페이먼츠 결제 로직을 모두 걷어내고 **카카오페이 API (단건 결제)**로 전면 교체하려고 해. 아래 단계에 맞춰 코드를 수정해 줘.

## 1. 환경 변수 및 의존성 정리
- 기존 토스페이먼츠 관련 패키지나 스크립트가 있다면 삭제(또는 주석 처리)해 줘.
- 카카오페이 연동을 위해 `.env.local`에 추가해야 할 환경 변수명(`KAKAO_ADMIN_KEY` 또는 `KAKAO_SECRET_KEY`, `KAKAO_CID` 등)을 안내해 줘. (테스트용 가맹점 코드 CID는 `TC0ONETIME`을 기본으로 사용하도록 세팅해 줘.)

## 2. 결제 준비 (Ready) API 구현 (`/app/api/kakaopay/ready/route.ts`)
- 유저가 결제하기 버튼을 누르면 호출될 API를 만들어 줘.
- 카카오페이 `/v1/payment/ready` 엔드포인트로 상품명, 가격, 수량, 주문번호 등을 담아 POST 요청을 보내는 서버 로직을 작성해 줘.
- 응답으로 받은 `next_redirect_pc_url` (또는 모바일 URL)과 `tid` (결제 고유 번호)를 클라이언트에 반환해 줘. `tid`는 승인 단계에서 필요하므로 Supabase 주문 테이블이나 쿠키/세션에 임시 저장하는 로직도 추가해 줘.

## 3. 프론트엔드 결제 버튼 로직 수정
- 클래스 상세 페이지 및 장바구니 페이지의 결제 버튼을 누르면, 토스 위젯을 띄우는 대신 방금 만든 `/api/kakaopay/ready`를 호출하도록 수정해 줘.
- API 호출 후 반환받은 카카오페이 결제 URL(`next_redirect_pc_url`)로 페이지를 이동(`window.location.href`)시켜 줘.

## 4. 결제 승인 (Approve) 및 DB 업데이트 로직 (`/app/api/kakaopay/approve/route.ts` 또는 성공 페이지)
- 고객이 카카오페이 결제를 마치고 `approval_url`로 리다이렉트 될 때 넘어오는 `pg_token`을 받는 로직을 만들어 줘.
- 저장해 둔 `tid`와 `pg_token`을 이용해 카카오페이 `/v1/payment/approve` 엔드포인트에 최종 승인 요청을 보내줘.
- **[중요]** 결제 승인이 성공적으로 떨어지면, Supabase `Orders` 테이블의 상태를 'completed'로 바꾸고, 클래스 상품의 경우 `class_schedules` 테이블의 `remaining_seats`를 차감하는 기존 로직을 이 카카오페이 성공 흐름 안에 완벽하게 이식해 줘.
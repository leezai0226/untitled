---
description: 제안서 + 견적 생성 (PDF) — /proposal [리드 이름 또는 id] [패키지]
---

인자: $ARGUMENTS

## 동작

1. Supabase(`rylwhdwcierpgduzmajd`)의 `leads`에서 해당 리드를 조회한다.
2. 같은 리드의 진단 리포트(`sales/output/*-{기관명}/diagnosis.md`)가 있으면 읽어서 내용을 이어받는다. 없으면 먼저 `/diagnosis`를 돌릴지 묻는다.
3. `sales/templates/proposal.md` 틀을 채운다:
   1. 목표와 방향 (진단 요약 2~3문장)
   2. 패키지 비교 2~3개 — 인자로 받은 패키지(또는 진단의 추천 패키지)에 **추천 표시**
   3. 포함 / 불포함 범위 (`sales/config.json`의 includes 기준)
   4. 진행 일정: 계약 → 기획안 → **첫 촬영 예정일** → 첫 업로드
   5. 견적: 공급가, 부가세(10%), 합계, 결제 방식과 시기
   6. 유효기간: 기본 14일 (`contractDefaults.proposalValidDays`)
4. `sales/output/{YYYY-MM-DD}-{기관명}/proposal.md` 저장 후 PDF 변환:
   ```bash
   node sales/render.mjs "sales/output/{날짜}-{기관명}/proposal.md"
   ```
5. 리드 상태를 `proposed`로, `next_action_at`을 3일 뒤로 변경한다.

## 규칙

- **가격은 `sales/config.json`에서만 가져온다. 임의로 숫자를 만들지 않는다.** 가격이 비어 있으면 PDF를 만들기 전에 가격을 물어보고, 알려주면 config.json에도 반영한다.
- 부가세 계산은 공급가 기준 10%, 합계까지 정확히.

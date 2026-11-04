---
description: 진단 리포트 1장 생성 (PDF) — /diagnosis [리드 이름 또는 id]
---

인자: $ARGUMENTS

## 동작

1. Supabase(`rylwhdwcierpgduzmajd`)의 `leads`에서 해당 리드를 조회한다.
2. 상담 메모가 필요하다. 대화에서 아직 못 받았으면 **먼저 상담 내용을 물어본다** (지금 상황, 막힌 지점, 상담에서 나온 이야기). 지어내지 않는다.
3. `sales/templates/diagnosis-report.md` 틀을 채워 리포트를 작성한다:
   1. 지금 상황 한 줄 요약
   2. 막힌 지점 (기획 / 촬영 / 시간 / 운영 중 해당하는 것)
   3. 추천 영상 주제 10개 — **보는 사람의 고민으로 시작하는 제목 형태** (예: "무릎에서 소리가 나는데 병원에 가야 할까요?")
   4. 첫 달 계획 (몇 편, 언제 촬영)
   5. 광고 규정상 조심할 부분 (직군별 — 치료 효과 단정 금지, 승소 보장 표현 금지 등)
   6. 다음 단계: 추천 패키지 1개 + 이유 (`sales/config.json`의 패키지 중에서)
4. `sales/output/{YYYY-MM-DD}-{기관명}/diagnosis.md`로 저장 후 PDF 변환:
   ```bash
   node sales/render.mjs "sales/output/{날짜}-{기관명}/diagnosis.md"
   ```
5. 리드 상태를 `diagnosed`로 변경한다.

## 규칙

- **상담 당일 보내는 게 목표** — 30분 안에 끝날 분량(A4 1~2장)으로.
- 과장·단정 표현("100% 승소", 치료 효과 단정)은 예시 문구에도 쓰지 않는다.
- 가격을 언급할 땐 `sales/config.json` 값만 사용. 비어 있으면 "상담 후 안내".

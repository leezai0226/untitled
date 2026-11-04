---
description: 리드 조회·상태 변경 — /lead [이름 또는 id] [상태] ["메모"]
---

Supabase 프로젝트 `rylwhdwcierpgduzmajd`의 `leads` 테이블을 다루는 명령이다. Supabase MCP의 execute_sql을 사용한다.

인자: $ARGUMENTS

## 동작

1. **인자가 없으면** — 오늘 할 일 목록을 보여준다:
   ```sql
   select id, created_at::date as 신청일, type, name, org_name, profession,
          interested_package, budget_range, status, next_action_at, notes
   from leads
   where status = 'new' or next_action_at <= current_date
   order by created_at desc;
   ```
   표로 정리해서 보여주고, 각 리드에 추천 다음 행동을 한 줄씩 덧붙인다.

2. **이름 또는 id만 있으면** — 해당 리드를 찾아 전체 정보를 요약한다. 이름은 `name ilike '%...%'` 또는 `org_name ilike '%...%'`로 검색. 여러 건이면 목록을 보여주고 어느 것인지 묻는다.

3. **이름/id + 상태가 있으면** — 상태를 변경한다. 허용 상태: `new, contacted, diagnosis_booked, diagnosed, proposed, contracted, lost`. 세 번째 인자(따옴표 메모)가 있으면 `notes`에 기존 메모 뒤에 `[날짜] 메모` 형식으로 덧붙인다.
   - `contacted`로 바꾸면 `next_action_at`을 3일 뒤로 설정
   - `proposed`로 바꾸면 `next_action_at`을 3일 뒤로 설정
   - 변경 후 바뀐 리드를 다시 보여준다.

## 규칙

- 리드 데이터는 고객 개인정보다. 요약에 필요한 만큼만 출력하고, 파일로 저장하지 않는다 (sales/output/ 제외).
- 존재하지 않는 리드면 지어내지 말고 "없음"이라고 답한다.

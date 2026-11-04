---
description: 후속 연락 문구 초안 일괄 생성 — /followup
---

Supabase(`rylwhdwcierpgduzmajd`)의 `leads`에서 후속 연락이 필요한 리드를 모은다:

```sql
select id, created_at::date as 신청일, type, name, org_name, profession,
       interested_package, status, next_action_at, notes
from leads
where status not in ('contracted', 'lost')
  and (next_action_at <= current_date
       or (type = 'checklist' and status = 'new' and created_at <= now() - interval '3 days')
       or (status = 'diagnosed' and created_at <= now() - interval '3 days'))
order by next_action_at nulls last, created_at;
```

리드별로 상태에 맞는 **카톡용 연락 문구 초안**을 만든다. 존댓말, 짧게 (2~4문장), 부담 주지 않는 톤.

## 상태별 문구 가이드

- **checklist 다운로드 3일 후**: "체크리스트 보고 찍어보셨어요? 막히는 데 있으면 기획 진단으로 같이 봐드릴게요"
- **contacted (상담 전)**: 상담 일정 확인/리마인드
- **diagnosed (진단 후 제안서 미발송)**: 진단 리포트 잘 받으셨는지 + 제안서 보내드릴지
- **proposed 3일 후**: 제안서 검토 중이신지 가볍게 확인
- **proposed 7일 후**: 유효기간 안내 + 궁금한 점 문의 유도

## 규칙

- **자동으로 보내지 않는다.** 문구만 만들고 발송은 내가 한다.
- 각 문구는 코드블록으로 출력해서 바로 복사할 수 있게.
- 문구를 보낸 뒤에는 `/lead [이름] [상태] "메모"`로 기록하라고 마지막에 안내한다.

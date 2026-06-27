# Context — team-memory 통합 구조

이 디렉토리는 [team-memory-kit](https://github.com/Daegu-Agent-Crew/team-memory-kit)와의 연동을 위한 구조입니다.
스터디 기록(미션 제출, 분석 리포트)이 메모리 레코드로 저장되고, 위키로 컴파일됩니다.

## 디렉토리 구조

```
context/
├── README.md              ← 이 파일
├── records/               ← 원본 메모리 레코드 (JSON)
│   ├── week-01/           ← 주차별 폴더
│   │   ├── member-a.json  ← 멤버별 레코드
│   │   └── member-b.json
│   └── analysis/          ← /analyze 결과 리포트
│       └── week-01.json
└── registry/              ← 위키 컴파일 결과
    ├── by-week/           ← 주차별 위키
    ├── by-member/         ← 멤버별 위키
    └── by-topic/          ← 주제별 위키
```

## 레코드 스키마 (records/*.json)

```json
{
  "id": "week-01-member-a",
  "type": "mission-submit",
  "week": 1,
  "member": "member-a",
  "source": "00_missions/Week_01_submit/Week_01_member-a_submit.md",
  "content": "제출 내용 요약...",
  "skills": ["typescript", "agent-design"],
  "timestamp": "2026-06-27T10:00:00Z"
}
```

## team-memory-kit CLI 연동

### memory-ingest (스터디 기록 → 레코드)
```bash
# vault의 미션 제출 폴더를 스캔하여 context/records/에 JSON 저장
npx @daegu-agent-crew/team-memory-kit ingest \
  --source 00_missions/ \
  --output context/records/ \
  --format json
```

### memory-wiki (레코드 → 위키 컴파일)
```bash
# context/records/의 레코드를 위키로 컴파일
npx @daegu-agent-crew/team-memory-kit wiki \
  --input context/records/ \
  --output context/registry/ \
  --group-by week,member,topic
```

### memory-sync (위키 → 공개 배포)
```bash
# 컴파일된 위키를 공개 폴더로 동기화
npx @daegu-agent-crew/team-memory-kit sync \
  --source context/registry/ \
  --target posts/wiki/
```

## opt-in 설계

team-memory-kit은 **선택적 의존성**입니다:
- team-memory-kit 없이도 기본 운영 가능 (수동으로 records/에 JSON 작성)
- team-memory-kit 설치 시 자동 파이프라인 활성화
- CLI 미설치 시 안내 메시지만 표시

## CLE2 연동

CLE2의 `context/` 구조와 호환됩니다:
- 동일한 records/registry 패턴
- team-memory-kit CLI 호환
- 커뮤니티 맞춤: 주차/멤버/주제별 그룹화

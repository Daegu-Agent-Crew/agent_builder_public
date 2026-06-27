# Agent Builder Tasks — 커뮤니티 스터디 태스크 관리

각 스터디 미션이는 독립적인 태스크 폴더를 가지며, 표준화된 4개 문서로 관리됩니다.

## 태스크 ID 규칙 (AB-N)

| 접두사 | 의미 | 예시 |
|--------|------|------|
| `AB-` | Agent Builder 태스크 | AB-1, AB-2, AB-3... |

- 순차 증가 (이슈 번호와 별개)
- 하나의 GitHub 이슈 = 하나의 태스크
- 태스크가 이슈보다 먼저 생성될 수도 있음 (이슈는 나중에 연결)

## 디렉토리 구조

```
tasks/
├── README.md            ← 이 파일 (운영 규칙)
├── _template/           ← 새 태스크 생성용 템플릿
│   ├── GOAL.md          ← 목표, 성공 기준, 범위
│   ├── PLAN.md          ← 실행 계획, 단계, 의존성
│   ├── STATUS.md        ← 현재 상태, 진행률, 변경 이력
│   └── TESTS.md         ← 검증 기준, 테스트 항목
├── AB-1/                ← 첫 번째 태스크
│   └── [태스크-슬러그]/
│       ├── GOAL.md
│       ├── PLAN.md
│       ├── STATUS.md
│       └── TESTS.md
└── ...
```

## 문서 작성 규칙

### GOAL.md
- 목표를 1~2문장으로 명확히 서술
- 성공 기준(Definition of Done)은 체크리스트로 작성
- 범위(In/Out Scope)를 명확히 구분

### PLAN.md
- 단계별로 담당자, 입력, 출력, 세부 항목을 명시
- 의존성과 리스크를 미리 파악

### STATUS.md
- 진행 상태를 주기적으로 업데이트
- 진행률 % 또는 Step X/Y 형태로 표시
- 블로커 발생 시 즉시 기록

### TESTS.md
- 기능/비기능 테스트 항목을 사전 정의
- 검증 일자와 결과를 기록

## 새 태스크 생성 방법

```bash
# 1. 템플릿 복사
cp -r tasks/_template tasks/AB-N/태스크-슬러그

# 2. 각 파일의 [태스크 이름]을 실제 이름으로 교체
# 3. GOAL/PLAN 작성 후 STATUS를 "⏸ 대기"로 설정
# 4. GitHub 이슈 생성 후 GOAL.md에 이슈 번호 연결
```

## CLE2 연동

이 태스크 구조는 [CLE2](https://github.com/Daegu-Agent-Crew/creative-loop-engineering2)의 태스크 관리 패턴을 커뮤니티 맞춤으로 가져온 것입니다.
CLE2의 `tasks/README.md` 운영 규칙을 기반으로 하되, 스터디/커뮤니티 맥락에 맞게 단순화했습니다.

# PLAN — 스터디 미션 워크플로우 정의

## 실행 계획

### Step 1: 미션 라이프사이클 정의
- **담당**: 대구루
- **입력**: starter-kit 미션 구조, CLE2 태스크 패턴
- **출력**: 미션 워크플로우 문서
- **세부**:
  - 출제: 운영자가 AB-N 태스크 + 이슈 생성
  - 제출: 멤버가 `00_missions/Week_N_submit/`에 마크다운 작성
  - 분석: `/analyze N` 실행 → 90_analysis/ 리포트 생성
  - 피드백: 이슈 댓글 + Discord 알림

### Step 2: 미션 템플릿 작성
- **담당**: 대구루
- **입력**: 기존 미션 폴더 구조
- **출력**: `tasks/AB-2/study-mission-workflow/templates/` 템플릿
- **세부**:
  - `Week_N_submit_template.md` (멤버 제출용)
  - `mission-design-template.md` (운영자 출제용)

### Step 3: team-memory 연동 지점 설계
- **담당**: 대구루
- **입력**: team-memory-kit CLI 구조
- **출력**: 연동 지점 명세 (Phase 2에서 구현)
- **세부**:
  - 분석 리포트 → memory-ingest 입력
  - 위키 컴파일 → memory-wiki 출력
  - 연동 지점을 인터페이스로만 정의

## 의존성
- AB-1 (Starter Kit 온보딩) 선행 권장
- team-memory-kit CLI (Phase 2)

## 리스크
- 미션 구조가 기존 starter-kit 관례와 충돌하지 않도록 호환성 유지

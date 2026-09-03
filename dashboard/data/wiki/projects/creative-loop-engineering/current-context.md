# Creative Loop Engineering (CLE)

[source: context/records/projects/three-body-comic/2026-06-12-strategy-doc-review.md]
[source: context/records/projects/three-body-comic/2026-06-12-project-setup-ep001-script.md]

## 프로젝트 개요
창의적 루프 엔지니어링 시스템 SPA. GitHub Pages 호스팅.
- URL: https://daegu-agent-crew.github.io/creative-loop-engineering/
- Repo: Daegu-Agent-Crew/creative-loop-engineering

## 기술 스택
- 단일 HTML SPA (2292줄)
- 순수 JavaScript (App 객체 기반 라우팅)
- localStorage 기반 데이터 저장
- GitHub API 연동 (PAT 기반)

## Codex CLI Timeout 가이드라인

| 작업 유형 | 권장 timeout | 비고 |
|-----------|-------------|------|
| 짧은 수정/질의응답 | 600~900초 (10~15분) | 1~100줄 수정 |
| 코드베이스 탐색/다단계 리팩터링/테스트 | 1800초 (30분) | 파일 분석+수정 병행 |
| 로컬 모델, cold start, 큰 의존성 | 1800초 이상 | 안전 마진 |

### 참고
- Codex CLI 자체에 timeout 옵션 없음 → exec 측 timeout으로 제어
- exec yieldMs는 Codex 응답 대기 시간 (poll로 체크)
- 응답 없이 멈추면 kill 후 직접 수정 권장

## 알려진 이슈 (2026-06-20 해결)
- HTML 엔티티 인코딩 → 디코딩 완료
- CSS 변수 em-dash 오류 → 수정 완료
- 누락 메서드 (renderLandingEnhanced 등) → renderRequestPanel 대체
- panel-subtitle 속성 오류 → 수정 완료

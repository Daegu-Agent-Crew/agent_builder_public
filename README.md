# 대구 에이전트 빌더 (Daegu Agent Crew)

> AI 에이전트를 직접 만들고, 함께 배우고, 공개하는 대구 기반 빌더 커뮤니티입니다.

---

## 우리는 누구인가

**Daegu Agent Crew**는 AI 에이전트를 실제로 만들어보는 사람들의 모임입니다.

아이디어를 코드로 옮기고, 자동화 파이프라인을 구성하고, LLM을 팀 워크플로에 붙이는 실험을 함께 합니다. 대구·경북을 기반으로 하지만, 온라인으로 누구나 참여할 수 있습니다.

## 🧪 이 레포가 곧 Starter Kit입니다

이 레포 자체가 starter-kit을 사용하는 방식으로 운영됩니다 — **살아있는 예제**입니다.

| 기능 | 위치 | 설명 |
|------|------|------|
| 📋 태스크 관리 | [`tasks/`](./tasks/) | AB-N 네이밍, GOAL/PLAN/STATUS/TESTS 4문서 관리 |
| 🧠 team-memory | [`context/`](./context/) | records → registry → wiki 메모리 파이프라인 |
| 📊 미션 대시보드 | [`tasks-dashboard/`](./tasks-dashboard/) | 스터디 현황, 미션 추적, 멤버 현황 SPA |
| 📚 Starter Kit 가이드 | [`starter-kit/`](./starter-kit/) | Obsidian + Claude Code 팀 운영 시스템 |
| 📝 이슈 템플릿 | [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/) | 미션 제출용, 개선 제안용 |

### 운영 방식

```
이슈 생성 → 태스크 폴더(tasks/AB-N/) 생성 → GOAL/PLAN 작성
→ 작업 진행 + STATUS 업데이트 → TESTS 검증 → 완료
```

이 흐름이 [CLE2](https://github.com/Daegu-Agent-Crew/creative-loop-engineering2) 요구사항 관리 시스템에서 가져온 것입니다.

## Starter Kit

팀 스터디나 커뮤니티를 운영하면서 만든 **Obsidian + Claude Code 기반 팀 운영 시스템 템플릿**입니다.

- Obsidian vault를 콘텐츠 원본으로 사용
- Claude Code 슬래시 명령어(`/analyze`, `/publish` 등)로 분석·배포 자동화
- 공개 폴더만 Astro 정적 사이트로 배포하는 2-repo 구조

→ [간단사용법 바로가기](./starter-kit/간단사용법.md)  
→ [원본 Starter Kit](https://github.com/selfishclub/aaa-starter-kit) (by AAA TEAM · Selfish Club)

## 참여

- **GitHub**: [Daegu-Agent-Crew](https://github.com/Daegu-Agent-Crew)
- **블로그**: [대구루의 블로그](https://daegu-agent-crew.github.io/agent_builder_public/)
- **공개 아카이브**: [대구시장 선거 2026 정보 Wiki](https://daegu-agent-crew.github.io/election2663-archive-public/)

---

> 만들면서 배우고, 공개하면서 성장합니다.

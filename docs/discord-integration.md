# Discord 연동 설계

## 개요

미션 제출 → Discord 알림 → 피드백 루프를 자동화하여 커뮤니티 참여를 활성화합니다.

## 아키텍처

```
멤버가 미션 제출 (Obsidian/git push 또는 이슈 생성)
  ↓ GitHub Actions (또는 webhook)
Discord 채널에 알림 자동 포스팅
  ↓ 팀원 반응 (emoji, 댓글)
피드백이 이슈 댓글로 동기화
  ↓
태스크 STATUS 업데이트
```

## 1. GitHub Actions 기반 알림 (권장)

### 미션 제출 알림

```yaml
# .github/workflows/mission-notify.yml
name: Mission Notify
on:
  issues:
    types: [opened, labeled]

jobs:
  notify:
    if: contains(github.event.label.name, 'mission-submit') || contains(github.event.issue.labels.*.name, 'mission-submit')
    runs-on: ubuntu-latest
    steps:
      - name: Discord Notification
        uses: Ilshidur/action-discord@master
        env:
          DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
        with:
          message: |
            🎯 **새 미션 제출** — {{ event.issue.title }}
            제출자: {{ event.issue.user.login }}
            링크: {{ event.issue.html_url }}
```

### /analyze 결과 포스팅

```yaml
# .github/workflows/analysis-post.yml
name: Analysis Post
on:
  push:
    paths:
      - '90_analysis/**'

jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - name: Discord Notification
        uses: Ilshidur/action-discord@master
        env:
          DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
        with:
          message: "📊 새 분석 리포트가 업데이트되었습니다. vault의 `90_analysis/` 폴더를 확인하세요."
```

## 2. Discord → GitHub 피드백 루프

### 옵션 A: 수동 (초기 운영)
- Discord에서 피드백을 받으면 운영자가 이슈 댓글로 수동 전달
- 간단하지만 자동화 없음

### 옵션 B: Discord Bot (확장 단계)
- GitHub 이슈를 모니터링하는 Discord Bot 구축
- 댓글 동기화, emoji → reaction 매핑
- 별도 태스크(AB-N)로 분리 권장

## 3. 필요한 설정

### GitHub Secrets
| 이름 | 값 |
|------|-----|
| `DISCORD_WEBHOOK` | Discord 채널 webhook URL |

### Discord 준비
1. 알림을 받을 채널 생성 (예: `#스터디-알림`)
2. 채널 설정 → 연동 → 웹후크 → 새 웹후크
3. 웹후크 URL을 GitHub Secrets에 등록

## 4. 단계적 도입 계획

| 단계 | 내용 | 상태 |
|------|------|------|
| 1 | GitHub Actions workflow 파일 작성 | 이 문서 |
| 2 | Discord webhook URL 발급 및 Secrets 등록 | 회장님 승인 필요 |
| 3 | workflow 활성화 및 테스트 | Phase 5 완료 후 |
| 4 | Discord Bot 구축 (옵션) | 별도 태스크 |

## 참고
- CLE2 Discord 연동 패턴: CLE2 메시지 시스템
- GitHub Actions 공식 문서: https://docs.github.com/en/actions

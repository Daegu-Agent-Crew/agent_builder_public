#!/usr/bin/env bash
set -euo pipefail

# fetch-github-activity.sh — Generate github-activity.json for the dashboard
# Fetches commit, PR, and issue data from GitHub API for all registered repos and members.

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DATA_FILE="$SCRIPT_DIR/data/dashboard.json"
OUTPUT="$SCRIPT_DIR/data/github-activity.json"

# Load token
ENV_FILE="${GITHUB_ENV_FILE:-$HOME/.openclaw/workspace/.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN not set" >&2
  exit 1
fi

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not found" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl not found" >&2; exit 1; }

ORG="Daegu-Agent-Crew"
API="https://api.github.com"
AUTH_HEADER="Authorization: token $GITHUB_TOKEN"

# Rate limit check
RATE_REMAINING=$(curl -sS -H "$AUTH_HEADER" "$API/rate_limit" | jq '.resources.core.remaining')
if [ "$RATE_REMAINING" -lt 50 ]; then
  echo "WARNING: Only $RATE_REMAINING API calls remaining. Aborting." >&2
  exit 1
fi
echo "API calls remaining: $RATE_REMAINING" >&2

# ── Helper: GitHub API with pagination ──

gh_paginate() {
  local url=$1 max=${2:-30}
  local page=1 results="[]"
  while [ "$page" -le "$max" ]; do
    local resp
    resp=$(curl -sS -H "$AUTH_HEADER" -H "Accept: application/vnd.github+json" "${url}&page=${page}&per_page=100")
    local count
    count=$(printf '%s' "$resp" | jq 'length')
    [ "$count" -eq 0 ] && break
    results=$(printf '%s' "$results" | jq --argjson resp "$resp" '. + $resp')
    [ "$count" -lt 100 ] && break
    page=$((page + 1))
  done
  printf '%s' "$results"
}

# ── Read repos and members from dashboard.json ──

REPO_SLUGS=$(jq -r '.repositories[].slug' "$DATA_FILE")
MEMBERS=$(jq -r '.members[]' "$DATA_FILE")

# Normalize repo slugs — some may be just names like "three-body-comic"
normalize_slug() {
  local slug=$1
  if [[ "$slug" == */* ]]; then
    printf '%s' "$slug"
  else
    printf '%s/%s' "$ORG" "$slug"
  fi
}

# ── 30 days ago ──
SINCE_DATE=$(date -u -d '30 days ago' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -v-30d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo "")
if [ -z "$SINCE_DATE" ]; then
  # Fallback: use python
  SINCE_DATE=$(python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)-timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
fi
echo "Fetching activity since $SINCE_DATE" >&2

# ── Collect repo data ──
REPOS_JSON="[]"
ACTIVITY_FEED="[]"
MEMBER_STATS=$(printf '%s\n' "$MEMBERS" | jq -R '.' | jq -s 'map({login:., commits:0, prs:0, issues:0, reviews:0})')

echo "" >&2
for slug in $REPO_SLUGS; do
  FULL_SLUG=$(normalize_slug "$slug")
  REPO_NAME="${FULL_SLUG#*/}"
  echo "  → $FULL_SLUG" >&2

  # Repo info
  REPO_INFO=$(curl -sS -H "$AUTH_HEADER" "$API/repos/$FULL_SLUG" 2>/dev/null || '{}')
  OPEN_ISSUES=$(printf '%s' "$REPO_INFO" | jq -r '.open_issues_count // 0')
  UPDATED_AT=$(printf '%s' "$REPO_INFO" | jq -r '.updated_at // ""')
  PUSHED_AT=$(printf '%s' "$REPO_INFO" | jq -r '.pushed_at // ""')
  IS_PRIVATE=$(printf '%s' "$REPO_INFO" | jq -r '.private // false')

  # Recent commits (5)
  COMMITS=$(curl -sS -H "$AUTH_HEADER" "$API/repos/$FULL_SLUG/commits?per_page=5" 2>/dev/null || '[]')
  COMMIT_COUNT_RECENT=$(printf '%s' "$COMMITS" | jq 'length')

  # Open PRs
  PRS=$(curl -sS -H "$AUTH_HEADER" "$API/repos/$FULL_SLUG/pulls?state=open&per_page=30" 2>/dev/null || '[]')
  OPEN_PR_COUNT=$(printf '%s' "$PRS" | jq 'length')

  # Recent PRs (3 most recent, regardless of state)
  RECENT_PRS=$(curl -sS -H "$AUTH_HEADER" "$API/repos/$FULL_SLUG/pulls?state=all&sort=updated&direction=desc&per_page=3" 2>/dev/null || '[]')

  # Build repo entry
  REPO_ENTRY=$(jq -n \
    --arg slug "$FULL_SLUG" \
    --arg name "$REPO_NAME" \
    --argjson private "$IS_PRIVATE" \
    --argjson openIssues "$OPEN_ISSUES" \
    --argjson openPRs "$OPEN_PR_COUNT" \
    --arg updatedAt "$UPDATED_AT" \
    --arg pushedAt "$PUSHED_AT" \
    --argjson recentCommits "$COMMITS" \
    --argjson recentPRs "$RECENT_PRS" \
    '{
      slug: $slug,
      name: $name,
      private: $private,
      open_issues: $openIssues,
      open_prs: $openPRs,
      updated_at: $updatedAt,
      pushed_at: $pushedAt,
      recent_commits: ($recentCommits | map({
        sha: .sha[0:7],
        message: (.commit.message | split("\n")[0]),
        author: (.author.login // .commit.author.name // "unknown"),
        date: .commit.author.date
      })),
      recent_prs: ($recentPRs | map({
        number: .number,
        title: .title,
        author: .user.login,
        state: .state,
        updated_at: .updated_at,
        url: .html_url
      }))
    }')

  REPOS_JSON=$(printf '%s' "$REPOS_JSON" | jq --argjson entry "$REPO_ENTRY" '. + [$entry]')

  # Build activity feed entries from commits
  FEED_FROM_COMMITS=$(printf '%s' "$COMMITS" | jq --arg repo "$REPO_NAME" --arg type "commit" 'map({
    type: $type,
    repo: $repo,
    author: (.author.login // .commit.author.name // "unknown"),
    message: (.commit.message | split("\n")[0]),
    sha: .sha[0:7],
    date: .commit.author.date,
    url: ("https://github.com/'"$ORG"'/'"$REPO_NAME"'/commit/" + .sha)
  })')
  ACTIVITY_FEED=$(printf '%s' "$ACTIVITY_FEED" | jq --argjson items "$FEED_FROM_COMMITS" '. + $items')

  # Build activity feed entries from PRs
  FEED_FROM_PRS=$(printf '%s' "$RECENT_PRS" | jq --arg repo "$REPO_NAME" --arg type "pr" 'map({
    type: $type,
    repo: $repo,
    author: .user.login,
    message: .title,
    number: .number,
    state: .state,
    date: .updated_at,
    url: .html_url
  })')
  ACTIVITY_FEED=$(printf '%s' "$ACTIVITY_FEED" | jq --argjson items "$FEED_FROM_PRS" '. + $items')

  # Update member stats from commits
  for member in $MEMBERS; do
    MC=$(printf '%s' "$COMMITS" | jq --arg m "$member" '[.[] | select((.author.login // .commit.author.name // "") == $m)] | length')
    if [ "$MC" -gt 0 ]; then
      MEMBER_STATS=$(printf '%s' "$MEMBER_STATS" | jq --arg m "$member" --argjson c "$MC" 'map(if .login == $m then .commits += $c else . end)')
    fi
  done

  # Update member stats from PRs
  for member in $MEMBERS; do
    PC=$(printf '%s' "$RECENT_PRS" | jq --arg m "$member" '[.[] | select(.user.login == $m)] | length')
    if [ "$PC" -gt 0 ]; then
      MEMBER_STATS=$(printf '%s' "$MEMBER_STATS" | jq --arg m "$member" --argjson c "$PC" 'map(if .login == $m then .prs += $c else . end)')
    fi
  done

done

# Sort activity feed by date descending and take top 50
ACTIVITY_FEED=$(printf '%s' "$ACTIVITY_FEED" | jq 'sort_by(.date) | reverse | .[0:50]')

# Sort member stats by commits descending
MEMBER_STATS=$(printf '%s' "$MEMBER_STATS" | jq 'sort_by(-.commits)')

# ── Assemble final JSON ──
GENERATED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

RESULT=$(jq -n \
  --arg generated "$GENERATED" \
  --arg since "$SINCE_DATE" \
  --argjson repos "$REPOS_JSON" \
  --argjson activity "$ACTIVITY_FEED" \
  --argjson members "$MEMBER_STATS" \
  '{
    generated: $generated,
    since: $since,
    repos: $repos,
    activity_feed: $activity,
    member_stats: $members
  }')

mkdir -p "$(dirname "$OUTPUT")"
printf '%s\n' "$RESULT" > "$OUTPUT"
echo "Written to $OUTPUT" >&2
echo "$OUTPUT"

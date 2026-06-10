// Team Dashboard — dashboard.js

(function () {
  'use strict';

  var DATA_PATH = 'data/dashboard.json';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '';
    return d.slice(0, 10);
  }

  function statusBadge(status) {
    if (!status) return '';
    var cls = 'badge badge-' + status.toLowerCase().replace(/\s+/g, '-');
    return '<span class="' + cls + '">' + escapeHtml(status) + '</span>';
  }

  function taskIcon(status) {
    var icons = { 'pending': '⏳', 'in-progress': '🔄', 'done': '✅', 'blocked': '🚫' };
    return '<span class="task-status-icon ' + escapeHtml(status || 'pending') + '">' + (icons[status] || '⏳') + '</span>';
  }

  function decisionIcon(status) {
    var icons = { 'active': '✅', 'revised': '🔄', 'superseded': '⏭️', 'reverted': '↩️' };
    return '<span class="decision-icon">' + (icons[status] || '📜') + '</span>';
  }

  // Simple markdown→HTML (headings, bold, lists, links, code)
  function mdToHtml(md) {
    if (!md) return '';
    var html = escapeHtml(md);
    // Headings
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function (m) { return '<ul>' + m + '</ul>'; });
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Paragraphs (double newline)
    html = html.replace(/\n\n/g, '</p><p>');
    // Single newline → <br>
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }

  // ── Renderers ──

  function renderStats(data) {
    var projectCount = (data.projects || []).length;
    var recordCount = Object.values(data.records_by_project || {})
      .reduce(function (sum, recs) { return sum + recs.length; }, 0);
    var taskCount = (data.tasks || []).length;
    var memberCount = (data.members || []).length;
    var decisionCount = (data.decisions || []).length;

    var grid = $('#stats-grid');
    grid.innerHTML = [
      { value: projectCount, label: '프로젝트' },
      { value: recordCount, label: '공개 기록' },
      { value: taskCount, label: '태스크' },
      { value: decisionCount, label: '결정' },
      { value: memberCount, label: '멤버' }
    ].map(function (s) {
      return '<div class="stat-card"><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div></div>';
    }).join('');
  }

  function renderWiki(data) {
    var wiki = data.wiki || {};
    var projects = data.projects || [];
    var container = $('#wiki-content');

    var html = '';
    projects.forEach(function (p) {
      var content = wiki[p.id];
      if (!content) return;
      html += '<div class="wiki-project">' +
        '<h3>' + escapeHtml(p.name || p.id) + '</h3>' +
        '<div class="wiki-body">' + mdToHtml(content) + '</div>' +
      '</div>';
    });

    if (!html) {
      container.innerHTML = '<div class="empty-state">위키 요약이 아직 없습니다.</div>';
      return;
    }
    container.innerHTML = html;
  }

  function renderTimeline(data) {
    var timeline = data.timeline || [];
    var container = $('#timeline-list');
    var noTimeline = $('#no-timeline');

    if (timeline.length === 0) {
      container.innerHTML = '';
      noTimeline.style.display = 'block';
      return;
    }
    noTimeline.style.display = 'none';

    // Group by date
    var byDate = {};
    timeline.forEach(function (t) {
      var d = formatDate(t.date) || 'unknown';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(t);
    });

    var dates = Object.keys(byDate).sort().reverse();
    var html = '';

    dates.forEach(function (date) {
      html += '<div class="timeline-date-group">' +
        '<div class="timeline-date">' + escapeHtml(date) + '</div>' +
        '<div class="timeline-items">';

      byDate[date].forEach(function (t) {
        var summary = (t.summary || '').trim().split('\n').slice(0, 3).join(' ');
        if (summary.length > 150) summary = summary.slice(0, 150) + '...';
        html += '<div class="timeline-item">' +
          '<div class="timeline-item-header">' +
            '<span class="timeline-title">' + escapeHtml(t.title) + '</span>' +
            '<span class="timeline-meta">' +
              '<span class="badge badge-planning">' + escapeHtml(t.project || '') + '</span> ' +
              (t.member ? '👤 ' + escapeHtml(t.member) : '') +
            '</span>' +
          '</div>' +
          (summary ? '<div class="timeline-summary">' + escapeHtml(summary) + '</div>' : '') +
        '</div>';
      });

      html += '</div></div>';
    });

    container.innerHTML = html;
  }

  function renderProjects(data) {
    var projects = data.projects || [];
    var recsByProject = data.records_by_project || {};
    var repos = data.repositories || [];

    var container = $('#projects-list');
    container.innerHTML = projects.map(function (p) {
      var recs = recsByProject[p.id] || [];
      var projRepos = repos.filter(function (r) { return r.project === p.id; });
      var latestRec = recs.length > 0 ? recs[recs.length - 1] : null;

      return '<div class="project-card">' +
        '<h3>' + escapeHtml(p.name || p.id) + '</h3>' +
        '<span class="project-kind">' + escapeHtml(p.kind || '') + '</span> ' +
        statusBadge(p.status) +
        '<p class="project-desc">' + escapeHtml(p.description || '') + '</p>' +
        '<div class="project-meta">' +
          '<span>📄 ' + recs.length + ' 기록</span>' +
          (latestRec ? '<span>📅 최근 ' + formatDate(latestRec.date) + '</span>' : '') +
          (projRepos.length > 0 ? '<span>🔗 ' + projRepos.length + ' 리포</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderTasks(data) {
    var tasks = data.tasks || [];
    var container = $('#tasks-list');
    var noTasks = $('#no-tasks');

    if (tasks.length === 0) {
      container.innerHTML = '';
      noTasks.style.display = 'block';
      return;
    }
    noTasks.style.display = 'none';

    var order = { 'in-progress': 0, 'pending': 1, 'blocked': 2, 'done': 3 };
    tasks.sort(function (a, b) { return (order[a.status] || 99) - (order[b.status] || 99); });

    container.innerHTML = tasks.map(function (t) {
      return '<div class="task-item">' +
        taskIcon(t.status) +
        '<div class="task-info">' +
          '<div class="task-title">' + escapeHtml(t.title) + '</div>' +
          '<div class="task-meta">' +
            '<span>' + escapeHtml(t.project || '') + '</span>' +
            (t.milestone ? '<span>🎯 ' + escapeHtml(t.milestone) + '</span>' : '') +
            (t.assignee ? '<span>👤 ' + escapeHtml(t.assignee) + '</span>' : '') +
            (t.due ? '<span>📅 ' + formatDate(t.due) + '</span>' : '') +
          '</div>' +
        '</div>' +
        statusBadge(t.status) +
      '</div>';
    }).join('');
  }

  function renderDecisions(data) {
    var decisions = data.decisions || [];
    var container = $('#decisions-list');
    var noDec = $('#no-decisions');

    if (decisions.length === 0) {
      container.innerHTML = '';
      noDec.style.display = 'block';
      return;
    }
    noDec.style.display = 'none';

    container.innerHTML = decisions.map(function (d) {
      var bodyHtml = '';
      if (d.body) {
        bodyHtml = '<div class="decision-body">' + mdToHtml(d.body) + '</div>';
      }
      return '<div class="decision-card">' +
        '<div class="decision-header">' +
          decisionIcon(d.status) +
          '<div class="decision-info">' +
            '<div class="decision-title">' + escapeHtml(d.title) + '</div>' +
            '<div class="decision-meta">' +
              '<span>' + escapeHtml(d.project || '') + '</span>' +
              '<span>📅 ' + formatDate(d.date) + '</span>' +
              (d.member ? '<span>👤 ' + escapeHtml(d.member) + '</span>' : '') +
            '</div>' +
          '</div>' +
          statusBadge(d.status) +
        '</div>' +
        bodyHtml +
      '</div>';
    }).join('');
  }

  function renderMembers(data) {
    var members = data.members || [];
    var recsByProject = data.records_by_project || {};
    var container = $('#members-list');

    // Count records per member
    var memberCounts = {};
    Object.values(recsByProject).forEach(function (recs) {
      recs.forEach(function (r) {
        if (r.member) memberCounts[r.member] = (memberCounts[r.member] || 0) + 1;
      });
    });

    container.innerHTML = members.map(function (m) {
      var initial = m.charAt(0).toUpperCase();
      var count = memberCounts[m] || 0;
      return '<div class="member-card">' +
        '<div class="member-avatar">' + escapeHtml(initial) + '</div>' +
        '<div class="member-name">' + escapeHtml(m) + '</div>' +
        '<div class="member-handle">@' + escapeHtml(m) + '</div>' +
        '<div class="member-count">📄 ' + count + ' 기록</div>' +
      '</div>';
    }).join('');
  }

  function renderRecords(data) {
    var projects = data.projects || [];
    var recsByProject = data.records_by_project || {};
    var tabBar = $('#records-tabs');
    var content = $('#records-content');

    if (projects.length === 0) {
      tabBar.innerHTML = '';
      content.innerHTML = '<div class="empty-state">기록이 없습니다.</div>';
      return;
    }

    tabBar.innerHTML = projects.map(function (p, i) {
      return '<button class="tab-btn' + (i === 0 ? ' active' : '') + '" data-project="' + escapeHtml(p.id) + '">' +
        escapeHtml(p.name || p.id) +
        ' (' + (recsByProject[p.id] || []).length + ')' +
      '</button>';
    }).join('');

    function showProject(projectId) {
      var recs = recsByProject[projectId] || [];
      if (recs.length === 0) {
        content.innerHTML = '<div class="empty-state">이 프로젝트에 공개 기록이 없습니다.</div>';
        return;
      }
      var sorted = recs.slice().reverse();
      content.innerHTML = sorted.map(function (r) {
        var bodyPreview = '';
        if (r.body) {
          var preview = r.body.trim().split('\n').slice(0, 2).join(' ');
          if (preview.length > 120) preview = preview.slice(0, 120) + '...';
          if (preview) bodyPreview = '<div class="record-preview">' + escapeHtml(preview) + '</div>';
        }
        return '<div class="record-item">' +
          '<span class="record-date">' + formatDate(r.date) + '</span>' +
          '<div class="record-main">' +
            '<span class="record-title">' + escapeHtml(r.title) + '</span>' +
            '<span class="record-source">' + escapeHtml(r.member || '') + ' · ' + escapeHtml(r.source_type || '') + '</span>' +
            bodyPreview +
          '</div>' +
        '</div>';
      }).join('');
    }

    showProject(projects[0].id);

    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      $$('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      showProject(btn.dataset.project);
    });
  }

  // ── Init ──

  function init(data) {
    $('#loading').style.display = 'none';
    $('#content').style.display = 'block';

    var gen = data.generated ? data.generated.replace('T', ' ').replace('Z', ' UTC') : '';
    $('#generated-time').textContent = gen;

    renderStats(data);
    renderWiki(data);
    renderTimeline(data);
    renderProjects(data);
    renderTasks(data);
    renderDecisions(data);
    renderMembers(data);
    renderRecords(data);
    setupHelpModals();
  }

  // ── Help Modal System ──

  var helpContent = {
    overview: {
      title: '📊 팀 개요 — 작동 방식',
      body: '<h4>데이터는 어디서 오나요?</h4>' +
        '<p>대시보드는 <code>team-memory</code> 리포지토리의 데이터를 기반으로 자동 생성됩니다.</p>' +
        '<h4>업데이트 방법</h4>' +
        '<ol>' +
        '<li><code>team-memory</code>에 레코드를 추가하거나 수정합니다</li>' +
        '<li><code>bin/memory-dashboard --output dashboard.json</code> 실행</li>' +
        '<li>생성된 JSON을 <code>agent_builder_public/dashboard/data/</code>에 커밋</li>' +
        '</ol>' +
        '<div class="tip">💡 자동화: GitHub Actions를 연동하면 <code>team-memory</code> push 시 자동으로 JSON이 갱신될 수 있습니다.</div>' +
        '<h4>관련 명령어</h4>' +
        '<pre><code># team-memory 리포에서 실행\nbin/memory-dashboard --output context/dashboard.json\n\n# 전체 검증 후 대시보드 생성\nbin/memory-verify \&\& bin/memory-dashboard --output context/dashboard.json</code></pre>'
    },

    wiki: {
      title: '📖 위키 요약 — 업데이트 방법',
      body: '<h4>위키란?</h4>' +
        '<p>각 프로젝트의 <strong>현재 컨텍스트 요약</strong>입니다. 소스 레코드에서 자동 생성됩니다.</p>' +
        '<h4>위키 갱신 절차</h4>' +
        '<pre><code># 1. 레코드를 먼저 추가\nbin/memory-ingest \\\n  --project &lt;project&gt; \\\n  --member &lt;github-username&gt; \\\n  --source-type research-note \\\n  --title "조사 제목" \\\n  note.md\n\n# 2. 위키 재생성\nbin/memory-wiki --project &lt;project&gt;\n\n# 3. 검증\nbin/memory-verify\n\n# 4. 대시보드 JSON 재생성\nbin/memory-dashboard --output context/dashboard.json</code></pre>' +
        '<h4>위키 작성 규칙</h4>' +
        '<ul>' +
        '<li>직접 편집하지 않습니다 — <code>memory-wiki</code>가 레코드에서 자동 생성</li>' +
        '<li>모든 인용은 <code>[source: context/records/...]</code> 형식</li>' +
        '<li>레코드가 충돌하면 한쪽을 없애지 말고 충돌을 보존</li>' +
        '</ul>' +
        '<div class="tip">💡 스킬: <code>tm-wiki</code> / 명령어: <code>bin/memory-wiki</code></div>'
    },

    timeline: {
      title: '🕐 타임라인 — 레코드 추가 방법',
      body: '<h4>타임라인에 항목 추가하기</h4>' +
        '<p>새 레코드를 <code>memory-ingest</code>로 추가하면 자동으로 타임라인에 나타납니다.</p>' +
        '<h4>레코드 추가 절차</h4>' +
        '<pre><code># 1. 메모 파일 작성\ncat > /tmp/note.md &lt;&lt;EOF\n---\nproject: daegu-agent-crew\nmember: sfex11\nsource_type: research-note\ndate: 2026-06-10\ntitle: "조사 제목"\n---\n\n# 내용\n...\nEOF\n\n# 2. ingest\nbin/memory-ingest \\\n  --project daegu-agent-crew \\\n  --member sfex11 \\\n  --source-type research-note \\\n  --title "조사 제목" \\\n  /tmp/note.md\n\n# 3. 위키 + 검증 + 대시보드 재생성\nbin/memory-wiki --project daegu-agent-crew\nbin/memory-verify\nbin/memory-dashboard --output context/dashboard.json</code></pre>' +
        '<h4>허용되는 source_type</h4>' +
        '<ul>' +
        '<li><code>codex-session</code> — 코딩 세션 기록</li>' +
        '<li><code>meeting-note</code> — 회의록</li>' +
        '<li><code>research-note</code> — 조사 기록</li>' +
        '<li><code>decision</code> — 결정 사항</li>' +
        '<li><code>messenger-manual</code> — 메신저에서 수동 복사</li>' +
        '<li><code>markdown</code> — 일반 마크다운</li>' +
        '<li><code>repo-note</code> — 리포 분석 노트</li>' +
        '</ul>' +
        '<div class="warn">⚠️ 인터뷰 등 민감한 레코드는 frontmatter에 <code>visibility: private</code>를 추가하면 대시보드에 노출되지 않습니다.</div>'
    },

    projects: {
      title: '🚀 프로젝트 — 등록 및 관리',
      body: '<h4>새 프로젝트 등록</h4>' +
        '<p><code>context/registry/projects/</code>에 YAML 파일을 추가합니다.</p>' +
        '<pre><code># context/registry/projects/my-project.yml\nid: my-project\nname: "내 프로젝트"\nstatus: active\nkind: "development"\ndescription: "프로젝트 설명"</code></pre>' +
        '<h4>프로젝트 상태값</h4>' +
        '<ul>' +
        '<li><code>active</code> — 활성</li>' +
        '<li><code>planning</code> — 기획 중</li>' +
        '<li><code>paused</code> — 일시 중단</li>' +
        '<li><code>completed</code> — 완료</li>' +
        '</ul>' +
        '<h4>리포지토리 연결</h4>' +
        '<p><code>context/registry/repositories/</code>에 프로젝트와 연결할 리포를 등록합니다.</p>' +
        '<pre><code># context/registry/repositories/my-repo.yml\nslug: my-repo\nproject: my-project\nrole: "리포 설명"\nurl: https://github.com/org/repo\naliases:\n  - org/repo</code></pre>' +
        '<div class="tip">💡 스킬: <code>tm-load</code>로 프로젝트 컨텍스트를 로드한 후 작업을 시작하세요.</div>'
    },

    tasks: {
      title: '✅ 태스크 — 추적 방법',
      body: '<h4>태스크 만들기</h4>' +
        '<p>레코드에 <code>task_phase</code> 프론트매터를 추가하면 자동으로 태스크로 인식됩니다.</p>' +
        '<pre><code># 레코드 파일 예시\n---\nschema_version: 1\ntitle: "API 서버 프로토타입 구현"\ndate: 2026-06-10\nproject: my-project\nmember: sfex11\nsource_type: decision\ntask_phase: development\ntask_status: in-progress\nmilestone: M1\nassignee: normalkim\ndue: 2026-07-01\nstatus: raw-record\n---\n\n# API 서버 프로토타입\nFastAPI 기반으로 ...</code></pre>' +
        '<h4>task_status 값</h4>' +
        '<ul>' +
        '<li><code>pending</code> ⏳ — 대기 중</li>' +
        '<li><code>in-progress</code> 🔄 — 진행 중</li>' +
        '<li><code>done</code> ✅ — 완료</li>' +
        '<li><code>blocked</code> 🚫 — 차단됨</li>' +
        '</ul>' +
        '<h4>필수 필드</h4>' +
        '<ul>' +
        '<li><code>task_phase</code> — 있어야 태스크로 인식됨</li>' +
        '<li><code>task_status</code> — 상태 (기본값: pending)</li>' +
        '</ul>' +
        '<h4>선택 필드</h4>' +
        '<ul>' +
        '<li><code>milestone</code> — 마일스톤 (예: M1, M2)</li>' +
        '<li><code>assignee</code> — 담당자 GitHub 아이디</li>' +
        '<li><code>due</code> — 마감일 (YYYY-MM-DD)</li>' +
        '</ul>' +
        '<div class="tip">💡 대시보드에서 진행 중(in-progress) 태스크가 상단에 표시됩니다.</div>'
    },

    decisions: {
      title: '📜 결정 로그 — 기록 방법',
      body: '<h4>결정 기록하기</h4>' +
        '<p>레코드에 <code>decision_status</code> 프론트매터를 추가하면 결정 로그에 자동 등록됩니다.</p>' +
        '<pre><code># 결정 레코드 예시\n---\nschema_version: 1\ntitle: "FastAPI를 백엔드로 채택"\ndate: 2026-06-10\nproject: my-project\nmember: sfex11\nsource_type: decision\ndecision_status: active\nstatus: raw-record\n---\n\n# FastAPI 백엔드 채택\n\n## 결정 내용\nREST API 서버를 FastAPI로 구현한다.\n\n## 결정 근거\n- 비동기 지원으로 성능 우수\n- 자동 Swagger 문서 생성\n- Python 생태계와 호환\n\n## 기각된 대안\n- Express.js: 팀 Python 역량 활용 불가\n- Django: 과도한 오버헤드</code></pre>' +
        '<h4>decision_status 값</h4>' +
        '<ul>' +
        '<li><code>active</code> ✅ — 현재 유효한 결정</li>' +
        '<li><code>revised</code> 🔄 — 수정됨 (새 결정이 후속)</li>' +
        '<li><code>superseded</code> ⏭️ — 새 결정으로 대체됨</li>' +
        '<li><code>reverted</code> ↩️ — 철회됨</li>' +
        '</ul>' +
        '<div class="tip">💡 결정 본문 전체가 대시보드에 마크다운으로 렌더링됩니다. 배경, 근거, 대안까지 상세히 적으면 팀에 큰 도움이 됩니다.</div>'
    },

    members: {
      title: '👥 멤버 — 등록 방법',
      body: '<h4>멤버 추가</h4>' +
        '<p><code>.github/team-memory-members.yml</code>에 GitHub 아이디를 추가합니다.</p>' +
        '<pre><code># .github/team-memory-members.yml\n# Daegu Agent Crew members\n- sfex11\n- normalkim\n- eugene\n- junteken</code></pre>' +
        '<h4>규칙</h4>' +
        '<ul>' +
        '<li>GitHub 아이디만 허용 (영문, 숫자, 하이픈)</li>' +
        '<li>이 목록에 있는 멤버만 레코드를 생성할 수 있음</li>' +
        '<li><code>memory-verify</code>가 이 목록으로 멤버를 검증</li>' +
        '</ul>' +
        '<div class="warn">⚠️ 멤버를 추가한 후 반드시 <code>bin/memory-verify</code>로 검증하세요.</div>'
    },

    records: {
      title: '📂 전체 기록 — 관리 방법',
      body: '<h4>기록의 생명주기</h4>' +
        '<p>모든 기록은 <strong>append-only</strong> (추가 전용)입니다. 한 번 생성하면 수정하지 않는 것이 원칙입니다.</p>' +
        '<h4>저장 위치</h4>' +
        '<pre><code>context/records/projects/&lt;project&gt;/YYYY-MM-DD-&lt;slug&gt;.md</code></pre>' +
        '<h4>공개/비공개 제어</h4>' +
        '<ul>' +
        '<li><code>visibility: private</code> → 대시보드에서 제외</li>' +
        '<li>visibility 필드 없음 → 기본 공개</li>' +
        '</ul>' +
        '<h4>전체 워크플로우</h4>' +
        '<pre><code># 1. 컨텍스트 로드\nbin/memory-load\n\n# 2. 레코드 추가\nbin/memory-ingest \\\n  --project &lt;project&gt; \\\n  --member &lt;github&gt; \\\n  --source-type &lt;type&gt; \\\n  --title "제목" \\\n  note.md\n\n# 3. 위키 갱신\nbin/memory-wiki --project &lt;project&gt;\n\n# 4. 검증\nbin/memory-verify\n\n# 5. 대시보드 재생성\nbin/memory-dashboard --output context/dashboard.json\n\n# 6. 공유 초안 (승인 필요)\nbin/memory-share-plan --project &lt;project&gt; --title "업데이트"</code></pre>' +
        '<div class="tip">💡 6단계 전체를 자동화하려면 <code>bin/memory-sync</code>를 사용하세요. verify + Git 상태를 한번에 확인합니다.</div>' +
        '<h4>금지 사항</h4>' +
        '<ul>' +
        '<li>비밀, 자격증명, 개인 연락처 기록 금지</li>' +
        '<li>외부 메신저 발송 전 반드시 승인 필요</li>' +
        '</ul>'
    }
  };

  function showModal(key) {
    var content = helpContent[key];
    if (!content) return;

    // Remove existing modal
    var existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-card">' +
        '<div class="modal-header">' +
          '<h3>' + content.title + '</h3>' +
          '<button class="modal-close" aria-label="닫기">✕</button>' +
        '</div>' +
        '<div class="modal-body">' + content.body + '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('.modal-close').addEventListener('click', function () {
      overlay.remove();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  function setupHelpModals() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.help-btn');
      if (!btn) return;
      var key = btn.dataset.help;
      if (key) showModal(key);
    });
  }

  fetch(DATA_PATH)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(init)
    .catch(function (err) {
      $('#loading').style.display = 'none';
      $('#error').style.display = 'block';
      $('#error').textContent = '대시보드 데이터를 불러오지 못했습니다: ' + err.message;
    });
})();

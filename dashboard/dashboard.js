// Team Dashboard — dashboard.js

(function () {
  'use strict';

  var DATA_PATH = 'data/dashboard.json';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  var _dashboardData = null; // cached data

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
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function (m) { return '<ul>' + m + '</ul>'; });
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }

  // ── Hash Router ──

  function getHash() {
    var h = window.location.hash;
    if (!h || h === '#' || h === '#/') return null;
    return h.replace(/^#\/?/, '');
  }

  function navigateTo(hash) {
    window.location.hash = '#/' + hash;
  }

  function handleRoute() {
    var fragment = getHash();
    if (fragment && fragment.indexOf('project/') === 0) {
      var projectId = fragment.replace('project/', '');
      renderProjectPage(projectId);
    } else {
      renderDashboard();
    }
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

      return '<a href="#/project/' + escapeHtml(p.id) + '" class="project-card" tabindex="0" aria-label="' + escapeHtml(p.name || p.id) + ' 상세 보기">' +
        '<h3>' + escapeHtml(p.name || p.id) + '</h3>' +
        '<span class="project-kind">' + escapeHtml(p.kind || '') + '</span> ' +
        statusBadge(p.status) +
        '<p class="project-desc">' + escapeHtml(p.description || '') + '</p>' +
        '<div class="project-meta">' +
          '<span>📄 ' + recs.length + ' 기록</span>' +
          (latestRec ? '<span>📅 최근 ' + formatDate(latestRec.date) + '</span>' : '') +
          (projRepos.length > 0 ? '<span>🔗 ' + projRepos.length + ' 리포</span>' : '') +
        '</div>' +
      '</a>';
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

  // ── Project Detail Page (full page) ──

  function renderProjectPage(projectId) {
    var data = _dashboardData;
    if (!data) return;

    var projects = data.projects || [];
    var project = projects.filter(function (p) { return p.id === projectId; })[0];
    if (!project) return;

    var recsByProject = data.records_by_project || {};
    var repos = data.repositories || [];
    var wiki = data.wiki || {};
    var tasks = (data.tasks || []).filter(function (t) { return t.project === projectId; });
    var decisions = (data.decisions || []).filter(function (d) { return d.project === projectId; });
    var timeline = (data.timeline || []).filter(function (t) { return t.project === projectId; });

    var recs = recsByProject[projectId] || [];
    var projRepos = repos.filter(function (r) { return r.project === projectId; });
    var wikiContent = wiki[projectId] || '';

    // Build page HTML
    var tabItems = [
      { key: 'overview', label: '개요' },
      { key: 'records', label: '기록 (' + recs.length + ')' },
      { key: 'wiki', label: '위키' },
      { key: 'timeline', label: '타임라인' },
      { key: 'tasks', label: '태스크 (' + tasks.length + ')' },
      { key: 'repos', label: '리포 (' + projRepos.length + ')' }
    ];

    var tabsHtml = '<div class="detail-tabs">' +
      tabItems.map(function (t, i) {
        return '<button class="detail-tab-btn' + (i === 0 ? ' active' : '') + '" data-tab="' + t.key + '">' + escapeHtml(t.label) + '</button>';
      }).join('') +
    '</div>';

    // Overview panel
    var overviewHtml = '<div class="detail-panel" data-panel="overview">' +
      '<div class="detail-field"><label>상태</label><div>' + statusBadge(project.status) + '</div></div>' +
      '<div class="detail-field"><label>유형</label><span>' + escapeHtml(project.kind || '-') + '</span></div>' +
      '<div class="detail-field"><label>설명</label><p>' + escapeHtml(project.description || '설명이 없습니다.') + '</p></div>' +
      '<div class="detail-stats-row">' +
        '<div class="detail-stat"><span class="detail-stat-value">' + recs.length + '</span><span class="detail-stat-label">기록</span></div>' +
        '<div class="detail-stat"><span class="detail-stat-value">' + tasks.length + '</span><span class="detail-stat-label">태스크</span></div>' +
        '<div class="detail-stat"><span class="detail-stat-value">' + decisions.length + '</span><span class="detail-stat-label">결정</span></div>' +
        '<div class="detail-stat"><span class="detail-stat-value">' + projRepos.length + '</span><span class="detail-stat-label">리포</span></div>' +
      '</div>' +
    '</div>';

    // Records panel
    var recordsHtml = '<div class="detail-panel" data-panel="records" style="display:none">';
    if (recs.length === 0) {
      recordsHtml += '<div class="empty-state">공개 기록이 없습니다.</div>';
    } else {
      var sorted = recs.slice().reverse();
      recordsHtml += sorted.map(function (r) {
        var preview = '';
        if (r.body) {
          var p = r.body.trim().split('\n').slice(0, 2).join(' ');
          if (p.length > 120) p = p.slice(0, 120) + '...';
          if (p) preview = '<div class="record-preview">' + escapeHtml(p) + '</div>';
        }
        return '<div class="record-item">' +
          '<span class="record-date">' + formatDate(r.date) + '</span>' +
          '<div class="record-main">' +
            '<span class="record-title">' + escapeHtml(r.title) + '</span>' +
            '<span class="record-source">' + escapeHtml(r.member || '') + ' · ' + escapeHtml(r.source_type || '') + '</span>' +
            preview +
          '</div>' +
        '</div>';
      }).join('');
    }
    recordsHtml += '</div>';

    // Wiki panel
    var wikiHtml = '<div class="detail-panel" data-panel="wiki" style="display:none">';
    wikiHtml += (!wikiContent) ?
      '<div class="empty-state">위키 요약이 없습니다.</div>' :
      '<div class="wiki-body">' + mdToHtml(wikiContent) + '</div>';
    wikiHtml += '</div>';

    // Timeline panel
    var tlHtml = '<div class="detail-panel" data-panel="timeline" style="display:none">';
    if (timeline.length === 0) {
      tlHtml += '<div class="empty-state">타임라인 항목이 없습니다.</div>';
    } else {
      timeline.slice().reverse().forEach(function (t) {
        var summary = (t.summary || '').trim().split('\n').slice(0, 3).join(' ');
        if (summary.length > 150) summary = summary.slice(0, 150) + '...';
        tlHtml += '<div class="timeline-item">' +
          '<div class="timeline-item-header">' +
            '<span class="timeline-title">' + escapeHtml(t.title) + '</span>' +
            '<span class="timeline-meta">' + (t.member ? '👤 ' + escapeHtml(t.member) : '') + '</span>' +
          '</div>' +
          '<div class="timeline-date-inline">' + formatDate(t.date) + '</div>' +
          (summary ? '<div class="timeline-summary">' + escapeHtml(summary) + '</div>' : '') +
        '</div>';
      });
    }
    tlHtml += '</div>';

    // Tasks panel
    var tasksHtml = '<div class="detail-panel" data-panel="tasks" style="display:none">';
    if (tasks.length === 0) {
      tasksHtml += '<div class="empty-state">추적 중인 태스크가 없습니다.</div>';
    } else {
      var order = { 'in-progress': 0, 'pending': 1, 'blocked': 2, 'done': 3 };
      tasks.sort(function (a, b) { return (order[a.status] || 99) - (order[b.status] || 99); });
      tasksHtml += tasks.map(function (t) {
        return '<div class="task-item">' +
          taskIcon(t.status) +
          '<div class="task-info">' +
            '<div class="task-title">' + escapeHtml(t.title) + '</div>' +
            '<div class="task-meta">' +
              (t.assignee ? '<span>👤 ' + escapeHtml(t.assignee) + '</span>' : '') +
              (t.due ? '<span>📅 ' + formatDate(t.due) + '</span>' : '') +
            '</div>' +
          '</div>' +
          statusBadge(t.status) +
        '</div>';
      }).join('');
    }
    tasksHtml += '</div>';

    // Repos panel
    var reposHtml = '<div class="detail-panel" data-panel="repos" style="display:none">';
    if (projRepos.length === 0) {
      reposHtml += '<div class="empty-state">등록된 리포가 없습니다.</div>';
    } else {
      reposHtml += '<div class="repo-list">' + projRepos.map(function (r) {
        var url = r.url || ('https://github.com/Daegu-Agent-Crew/' + r.slug);
        return '<div class="repo-item">' +
          '<div class="repo-slug">' +
            (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(r.slug) + '</a>' : escapeHtml(r.slug)) +
          '</div>' +
          '<div class="repo-role">' + escapeHtml(r.role || '') + '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
    reposHtml += '</div>';

    // Assemble full page
    var pageHtml =
      '<div class="detail-page">' +
        '<div class="detail-page-header">' +
          '<a href="#" class="detail-back-btn" id="detail-back-btn">← 대시보드로 돌아가기</a>' +
        '</div>' +
        '<div class="detail-page-title-bar">' +
          '<div>' +
            '<h1 class="detail-page-title">' + escapeHtml(project.name || project.id) + '</h1>' +
            '<div class="detail-page-badges">' +
              '<span class="project-kind">' + escapeHtml(project.kind || '') + '</span> ' +
              statusBadge(project.status) +
            '</div>' +
          '</div>' +
        '</div>' +
        tabsHtml +
        '<div class="detail-body">' +
          overviewHtml +
          recordsHtml +
          wikiHtml +
          tlHtml +
          tasksHtml +
          reposHtml +
        '</div>' +
      '</div>';

    // Replace main content
    var main = $('.dashboard-main');
    main.innerHTML = pageHtml;

    // Scroll to top
    window.scrollTo(0, 0);

    // Tab switching
    main.addEventListener('click', function (e) {
      var btn = e.target.closest('.detail-tab-btn');
      if (btn) {
        main.querySelectorAll('.detail-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        main.querySelectorAll('.detail-panel').forEach(function (p) { p.style.display = 'none'; });
        var panel = main.querySelector('.detail-panel[data-panel="' + btn.dataset.tab + '"]');
        if (panel) panel.style.display = 'block';
      }
    });
  }

  // ── Dashboard page (default view) ──

  function renderDashboard() {
    var data = _dashboardData;
    if (!data) return;

    // Re-render the full dashboard HTML
    var main = $('.dashboard-main');
    main.innerHTML =
      '<div id="loading" class="loading">불러오는 중...</div>' +
      '<div id="error" class="error" style="display:none"></div>' +
      '<div id="content" style="display:none">' +
        '<section id="overview" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">📊 팀 개요</h2><button class="help-btn" data-help="overview" aria-label="도움말">?</button></div>' +
          '<div class="stats-grid" id="stats-grid"></div>' +
        '</div></section>' +
        '<section id="wiki" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">📖 위키 요약</h2><button class="help-btn" data-help="wiki" aria-label="도움말">?</button></div>' +
          '<p class="section-desc">각 프로젝트의 현재 컨텍스트 요약</p>' +
          '<div id="wiki-content" class="wiki-container"></div>' +
        '</div></section>' +
        '<section id="timeline" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">🕐 타임라인</h2><button class="help-btn" data-help="timeline" aria-label="도움말">?</button></div>' +
          '<p class="section-desc">팀 활동을 시간순으로 정리합니다</p>' +
          '<div id="timeline-list" class="timeline"></div>' +
          '<div id="no-timeline" class="empty-state" style="display:none">공개 기록이 없습니다.</div>' +
        '</div></section>' +
        '<section id="projects" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">🚀 프로젝트</h2><button class="help-btn" data-help="projects" aria-label="도움말">?</button></div>' +
          '<div id="projects-list" class="card-grid"></div>' +
        '</div></section>' +
        '<section id="tasks" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">✅ 태스크</h2><button class="help-btn" data-help="tasks" aria-label="도움말">?</button></div>' +
          '<div id="tasks-list" class="task-list"></div>' +
          '<div id="no-tasks" class="empty-state" style="display:none">아직 추적 중인 태스크가 없습니다.</div>' +
        '</div></section>' +
        '<section id="decisions" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">📜 결정 로그</h2><button class="help-btn" data-help="decisions" aria-label="도움말">?</button></div>' +
          '<p class="section-desc">팀의 결정과 그 배경을 기록합니다</p>' +
          '<div id="decisions-list" class="decision-list"></div>' +
          '<div id="no-decisions" class="empty-state" style="display:none">아직 기록된 결정이 없습니다.</div>' +
        '</div></section>' +
        '<section id="members" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">👥 팀 멤버</h2><button class="help-btn" data-help="members" aria-label="도움말">?</button></div>' +
          '<div id="members-list" class="member-grid"></div>' +
        '</div></section>' +
        '<section id="records" class="section"><div class="section-inner">' +
          '<div class="section-title-wrap"><h2 class="section-title">📂 전체 기록</h2><button class="help-btn" data-help="records" aria-label="도움말">?</button></div>' +
          '<div id="records-tabs" class="tab-bar"></div>' +
          '<div id="records-content" class="records-content"></div>' +
        '</div></section>' +
      '</div>';

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
  }

  // ── Init ──

  function init(data) {
    _dashboardData = data;
    handleRoute();
  }

  // ── Help Modal System ──

  var HUMAN = '<span class="role-tag role-human">👤 사람</span>';
  var AGENT = '<span class="role-tag role-agent">🤖 에이전트</span>';

  var helpContent = {
    overview: {
      title: '📊 팀 개요 — 작동 방식',
      body: '<p>대시보드는 <code>team-memory</code> 리포의 데이터를 기반으로 자동 생성됩니다.</p>' +
        '<h4>' + HUMAN + ' 대시보드 갱신 지시</h4>' +
        '<p>에이전트에게 스킬로 지시합니다:</p>' +
        '<div class="tip"><code>tm-sync</code> 또는 <code>tm-dashboard</code></div>' +
        '<h4>' + AGENT + ' 실행 워크플로</h4>' +
        '<ol>' +
        '<li><code>bin/memory-verify</code> — 기록 검증</li>' +
        '<li><code>bin/memory-dashboard --output context/dashboard.json</code> — JSON 생성</li>' +
        '<li>JSON을 <code>agent_builder_public/dashboard/data/</code>에 커밋·푸시</li>' +
        '</ol>' +
        '<div class="tip">💡 GitHub Actions를 연동하면 <code>team-memory</code> push 시 자동 갱신도 가능합니다.</div>'
    },

    wiki: {
      title: '📖 위키 요약 — 업데이트 방법',
      body: '<p>각 프로젝트의 <strong>현재 컨텍스트 요약</strong>입니다. 소스 레코드에서 자동 생성됩니다.</p>' +
        '<h4>' + HUMAN + ' 위키 갱신 지시</h4>' +
        '<div class="tip"><code>tm-wiki</code></div>' +
        '<h4>' + AGENT + ' 실행 워크플로</h4>' +
        '<ol>' +
        '<li><code>bin/memory-ingest</code> — 레코드가 아직 없으면 먼저 추가</li>' +
        '<li><code>bin/memory-wiki --project &lt;project&gt;</code> — 위키 재생성</li>' +
        '<li><code>bin/memory-verify</code> — 인용·안전 검증</li>' +
        '</ol>' +
        '<h4>위키 규칙</h4>' +
        '<ul>' +
        '<li>직접 편집 금지 — <code>memory-wiki</code>가 레코드에서 자동 생성</li>' +
        '<li>모든 인용은 <code>[source: context/records/...]</code> 형식</li>' +
        '<li>레코드 충돌 시 한쪽을 없애지 말고 충돌 보존</li>' +
        '</ul>'
    },

    timeline: {
      title: '🕐 타임라인 — 레코드 추가 방법',
      body: '<p>새 레코드가 추가되면 자동으로 타임라인에 나타납니다.</p>' +
        '<h4>' + HUMAN + ' 레코드 추가 지시</h4>' +
        '<div class="tip"><code>tm-ingest</code></div>' +
        '<p>예: "경쟁사 X를 조사해서 team-memory에 기록해줘"</p>' +
        '<h4>' + AGENT + ' 실행 워크플로</h4>' +
        '<ol>' +
        '<li><code>.github/team-memory-members.yml</code>에서 멤버 확인</li>' +
        '<li>마크다운 노트 작성</li>' +
        '<li><code>bin/memory-ingest --project &lt;project&gt; --member &lt;github&gt; --source-type &lt;type&gt; --title "제목" note.md</code></li>' +
        '<li><code>bin/memory-wiki --project &lt;project&gt;</code></li>' +
        '<li><code>bin/memory-verify</code></li>' +
        '</ol>' +
        '<h4>source_type 종류</h4>' +
        '<ul>' +
        '<li><code>codex-session</code> · <code>meeting-note</code> · <code>research-note</code> · <code>decision</code> · <code>messenger-manual</code> · <code>markdown</code> · <code>repo-note</code></li>' +
        '</ul>' +
        '<div class="warn">⚠️ 민감한 레코드에 <code>visibility: private</code> 추가 → 대시보드에서 제외됩니다.</div>'
    },

    projects: {
      title: '🚀 프로젝트 — 등록 및 관리',
      body: '<h4>' + HUMAN + ' 프로젝트 등록 지시</h4>' +
        '<div class="tip"><code>tm-load</code> — 기존 프로젝트 확인 후 작업 시작</div>' +
        '<p>새 프로젝트가 필요하면 에이전트에게 지시:</p>' +
        '<p>"새 프로젝트 my-project를 등록해줘"</p>' +
        '<h4>' + AGENT + ' 실행 워크플로</h4>' +
        '<ol>' +
        '<li><code>context/registry/projects/my-project.yml</code> 작성</li>' +
        '<li><code>bin/memory-verify</code>로 검증</li>' +
        '</ol>' +
        '<pre><code># context/registry/projects/my-project.yml\nid: my-project\nname: "내 프로젝트"\nstatus: active\nkind: "development"\ndescription: "프로젝트 설명"</code></pre>' +
        '<h4>프로젝트 상태값</h4>' +
        '<ul><li><code>active</code> · <code>planning</code> · <code>paused</code> · <code>completed</code></li></ul>' +
        '<h4>리포지토리 연결</h4>' +
        '<p>에이전트가 <code>context/registry/repositories/</code>에 YAML을 작성합니다.</p>' +
        '<pre><code>slug: my-repo\nproject: my-project\nrole: "리포 설명"\nurl: https://github.com/org/repo</code></pre>'
    },

    tasks: {
      title: '✅ 태스크 — 추적 방법',
      body: '<h4>' + HUMAN + ' 태스크 생성 지시</h4>' +
        '<div class="tip"><code>tm-ingest</code></div>' +
        '<p>예: "API 서버 프로토타입을 태스크로 등록해줘. 담당 normalkim, 마감 7/1"</p>' +
        '<h4>' + AGENT + ' 실행 워크플로</h4>' +
        '<ol>' +
        '<li><code>task_phase</code> 필드가 포함된 레코드 작성</li>' +
        '<li><code>bin/memory-ingest</code>로 추가</li>' +
        '<li><code>bin/memory-verify</code>로 검증</li>' +
        '<li><code>bin/memory-dashboard</code>로 JSON 갱신</li>' +
        '</ol>' +
        '<h4>태스크 레코드 프론트매터</h4>' +
        '<pre><code>task_phase: development      # 필수 — 태스크로 인식됨\ntask_status: in-progress     # pending | in-progress | done | blocked\nmilestone: M1                # 선택\nassignee: normalkim          # 선택\ndue: 2026-07-01              # 선택</code></pre>' +
        '<h4>task_status 값</h4>' +
        '<ul>' +
        '<li><code>pending</code> ⏳ · <code>in-progress</code> 🔄 · <code>done</code> ✅ · <code>blocked</code> 🚫</li>' +
        '</ul>'
    },

    decisions: {
      title: '📜 결정 로그 — 기록 방법',
      body: '<h4>' + HUMAN + ' 결정 기록 지시</h4>' +
        '<div class="tip"><code>tm-ingest</code></div>' +
        '<p>예: "FastAPI 백엔드 채택을 결정 로그에 기록해줘"</p>' +
        '<h4>' + AGENT + ' 실행 워크플로</h4>' +
        '<ol>' +
        '<li><code>decision_status</code> 필드가 포함된 레코드 작성</li>' +
        '<li><code>bin/memory-ingest</code>로 추가</li>' +
        '<li><code>bin/memory-verify</code>로 검증</li>' +
        '</ol>' +
        '<pre><code>decision_status: active     # 필수 — 결정으로 인식됨\n\n# 본문에는 결정 내용, 근거, 기각된 대안 포함</code></pre>' +
        '<h4>decision_status 값</h4>' +
        '<ul>' +
        '<li><code>active</code> ✅ · <code>revised</code> 🔄 · <code>superseded</code> ⏭️ · <code>reverted</code> ↩️</li>' +
        '</ul>' +
        '<div class="tip">💡 결정 본문 전체가 대시보드에 렌더링됩니다. 배경·근거·대안까지 상세히 적으면 좋습니다.</div>'
    },

    members: {
      title: '👥 멤버 — 등록 방법',
      body: '<h4>' + HUMAN + ' 멤버 추가 지시</h4>' +
        '<p>에이전트에게 지시:</p>' +
        '<p>"새 멤버 github-id를 team-memory에 추가해줘"</p>' +
        '<div class="warn">⚠️ 멤버 추가는 <strong>반드시 사람이 승인</strong>해야 합니다. 에이전트가 임의로 추가하지 않습니다.</div>' +
        '<h4>' + AGENT + ' 실행 워크플로 (승인 후)</h4>' +
        '<ol>' +
        '<li><code>.github/team-memory-members.yml</code>에 GitHub 아이디 추가</li>' +
        '<li><code>bin/memory-verify</code>로 검증</li>' +
        '</ol>' +
        '<h4>규칙</h4>' +
        '<ul>' +
        '<li>GitHub 아이디만 허용 (영문, 숫자, 하이픈)</li>' +
        '<li>이 목록에 있는 멤버만 레코드 생성 가능</li>' +
        '</ul>'
    },

    records: {
      title: '📂 전체 기록 — 관리 방법',
      body: '<h4>기록 원칙</h4>' +
        '<p>모든 기록은 <strong>append-only</strong> (추가 전용)입니다.</p>' +
        '<h4>' + HUMAN + ' 작업 시작 지시</h4>' +
        '<div class="tip"><code>tm-load</code> — 프로젝트 컨텍스트 로드 후 작업 시작</div>' +
        '<h4>' + AGENT + ' 전체 워크플로</h4>' +
        '<ol>' +
        '<li><code>bin/memory-load</code> — 컨텍스트 로드</li>' +
        '<li><code>bin/memory-ingest</code> — 레코드 추가</li>' +
        '<li><code>bin/memory-wiki</code> — 위키 갱신</li>' +
        '<li><code>bin/memory-verify</code> — 검증</li>' +
        '<li><code>bin/memory-dashboard</code> — 대시보드 JSON 생성</li>' +
        '<li><code>bin/memory-share-plan</code> — 공유 초안 작성 (승인 필요)</li>' +
        '</ol>' +
        '<div class="tip">💡 <code>tm-sync</code> 스킬을 쓰면 verify + Git 상태를 한번에 확인합니다.</div>' +
        '<h4>공개/비공개 제어</h4>' +
        '<ul>' +
        '<li><code>visibility: private</code> → 대시보드에서 제외</li>' +
        '<li>visibility 필드 없음 → 기본 공개</li>' +
        '</ul>' +
        '<h4>금지 사항</h4>' +
        '<ul>' +
        '<li>비밀, 자격증명, 개인 연락처 기록 금지</li>' +
        '<li>외부 메신저 발송 전 <strong>반드시 사람 승인</strong></li>' +
        '</ul>'
    }
  };

  function showModal(key) {
    var content = helpContent[key];
    if (!content) return;

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

  // ── Bootstrap ──

  setupHelpModals();

  // Hash change routing
  window.addEventListener('hashchange', handleRoute);

  fetch(DATA_PATH)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(init)
    .catch(function (err) {
      var main = $('.dashboard-main');
      main.innerHTML = '<div class="error">대시보드 데이터를 불러오지 못했습니다: ' + escapeHtml(err.message) + '</div>';
    });
})();

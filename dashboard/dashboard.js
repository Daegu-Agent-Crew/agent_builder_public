// Team Dashboard — dashboard.js

(function () {
  'use strict';

  var DATA_PATH = 'data/dashboard.json';
  var ACTIVITY_PATH = 'data/github-activity.json';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  var _dashboardData = null;
  var _activityData = null;

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '';
    return d.slice(0, 10);
  }

  function formatDateTime(d) {
    if (!d) return '';
    return d.replace('T', ' ').replace('Z', ' UTC');
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.max(0, now - then);
    var mins = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);
    if (days > 0) return days + '일 전';
    if (hours > 0) return hours + '시간 전';
    if (mins > 0) return mins + '분 전';
    return '방금';
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

  function activityIcon(type) {
    var icons = { 'commit': '💻', 'pr': '🔀', 'issue': '❗', 'review': '👁️' };
    return icons[type] || '📝';
  }

  // Simple markdown→HTML
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

    // Add GitHub activity stats if available
    var activityItems = 0;
    var openPRs = 0;
    if (_activityData) {
      activityItems = (_activityData.activity_feed || []).length;
      (_activityData.repos || []).forEach(function (r) { openPRs += (r.open_prs || 0); });
    }

    var stats = [
      { value: projectCount, label: '프로젝트' },
      { value: recordCount, label: '공개 기록' },
      { value: taskCount, label: '태스크' },
      { value: decisionCount, label: '결정' },
      { value: memberCount, label: '멤버' }
    ];
    if (_activityData) {
      stats.push({ value: openPRs, label: '열린 PR' });
      stats.push({ value: activityItems, label: '활동(30일)' });
    }

    var grid = $('#stats-grid');
    grid.innerHTML = stats.map(function (s) {
      return '<div class="stat-card"><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div></div>';
    }).join('');
  }

  // ── Activity Feed (new) ──

  function renderActivityFeed() {
    var container = $('#activity-list');
    if (!_activityData || !_activityData.activity_feed || _activityData.activity_feed.length === 0) {
      container.innerHTML = '<div class="empty-state">최근 활동이 없습니다.</div>';
      return;
    }

    var feed = _activityData.activity_feed.slice(0, 30);
    container.innerHTML = feed.map(function (item) {
      var icon = activityIcon(item.type);
      var msg = escapeHtml((item.message || '').slice(0, 100));
      if (item.message && item.message.length > 100) msg += '…';

      var repoBadge = '<span class="activity-repo">' + escapeHtml(item.repo || '') + '</span>';
      var authorBadge = item.author ? '<span class="activity-author">👤 ' + escapeHtml(item.author) + '</span>' : '';
      var timeBadge = '<span class="activity-time">' + timeAgo(item.date) + '</span>';
      var link = item.url ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener" class="activity-link">↗</a>' : '';

      var typeLabel = item.type === 'pr' ? '#' + (item.number || '') : '#' + (item.sha || '');

      return '<div class="activity-item">' +
        '<span class="activity-icon">' + icon + '</span>' +
        '<div class="activity-content">' +
          '<div class="activity-msg">' + msg + ' <code class="activity-ref">' + typeLabel + '</code></div>' +
          '<div class="activity-meta">' + repoBadge + authorBadge + timeBadge + '</div>' +
        '</div>' +
        link +
      '</div>';
    }).join('');
  }

  // ── Repositories section (new) ──

  function renderRepositories() {
    var container = $('#repos-list');
    if (!_activityData || !_activityData.repos) {
      container.innerHTML = '<div class="empty-state">리포지토리 데이터를 불러올 수 없습니다.</div>';
      return;
    }

    var repos = _activityData.repos;
    container.innerHTML = repos.map(function (r) {
      var url = 'https://github.com/' + r.slug;
      var privateIcon = r.private ? '🔒' : '🌍';
      var prBadge = r.open_prs > 0 ? '<span class="repo-badge repo-badge-pr">🔀 ' + r.open_prs + ' PR</span>' : '';
      var issueBadge = r.open_issues > 0 ? '<span class="repo-badge repo-badge-issue">❗ ' + r.open_issues + '</span>' : '';
      var updated = r.pushed_at ? '<span class="repo-badge repo-badge-time">⏱ ' + timeAgo(r.pushed_at) + '</span>' : '';

      var commitList = '';
      if (r.recent_commits && r.recent_commits.length > 0) {
        commitList = '<div class="repo-commits">' +
          r.recent_commits.slice(0, 3).map(function (c) {
            var cmsg = escapeHtml((c.message || '').slice(0, 80));
            if (c.message && c.message.length > 80) cmsg += '…';
            return '<div class="repo-commit">' +
              '<code class="commit-sha">' + escapeHtml(c.sha) + '</code> ' +
              '<span class="commit-msg">' + cmsg + '</span> ' +
              '<span class="commit-author">' + escapeHtml(c.author || '') + '</span>' +
            '</div>';
          }).join('') +
        '</div>';
      }

      return '<div class="repo-card">' +
        '<div class="repo-card-header">' +
          '<span class="repo-private-icon">' + privateIcon + '</span>' +
          '<a href="' + url + '" target="_blank" rel="noopener" class="repo-card-slug">' + escapeHtml(r.slug) + '</a>' +
          '<div class="repo-card-badges">' + prBadge + issueBadge + updated + '</div>' +
        '</div>' +
        commitList +
      '</div>';
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

    // Normalize: accept both string and {username, displayName} formats
    var memberList = members.map(function (m) {
      return typeof m === 'string' ? { username: m, displayName: m } : m;
    });

    var memberCounts = {};
    Object.values(recsByProject).forEach(function (recs) {
      recs.forEach(function (r) {
        if (r.member) memberCounts[r.member] = (memberCounts[r.member] || 0) + 1;
      });
    });

    // Build stats map from activity data
    var statsMap = {};
    if (_activityData && _activityData.member_stats) {
      _activityData.member_stats.forEach(function (m) {
        statsMap[m.login] = m;
      });
    }

    container.innerHTML = memberList.map(function (m) {
      var login = m.username || m;
      var display = m.displayName || login;
      var initial = login.charAt(0).toUpperCase();
      var count = memberCounts[login] || 0;
      var stats = statsMap[login];
      var commits = stats ? stats.commits : 0;
      var prs = stats ? stats.prs : 0;
      var ghUrl = 'https://github.com/' + encodeURIComponent(login);

      var statBadges = '';
      if (commits > 0) statBadges += '<div class="member-stat">💻 ' + commits + ' 커밋</div>';
      if (prs > 0) statBadges += '<div class="member-stat">🔀 ' + prs + ' PR</div>';
      if (commits === 0 && prs === 0) statBadges = '<div class="member-stat member-stat-muted">최근 활동 없음</div>';

      return '<div class="member-card">' +
        '<a href="' + ghUrl + '" target="_blank" rel="noopener" class="member-avatar-link">' +
          '<div class="member-avatar">' + escapeHtml(initial) + '</div>' +
        '</a>' +
        '<div class="member-name"><a href="' + ghUrl + '" target="_blank" rel="noopener">' + escapeHtml(display) + '</a></div>' +
        '<div class="member-handle">@' + escapeHtml(login) + '</div>' +
        '<div class="member-records">📄 ' + count + ' 기록</div>' +
        statBadges +
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

  // ── Project Detail Page ──

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

    // Get activity data for this project's repos
    var projActivity = [];
    var projRepoSlugs = projRepos.map(function (r) { return r.slug; });
    if (_activityData && _activityData.activity_feed) {
      projActivity = _activityData.activity_feed.filter(function (a) {
        return projRepoSlugs.some(function (slug) {
          return slug.indexOf(a.repo) !== -1 || a.repo.indexOf(slug.split('/').pop()) !== -1;
        });
      }).slice(0, 10);
    }

    var tabItems = [
      { key: 'overview', label: '개요' },
      { key: 'records', label: '기록 (' + recs.length + ')' },
      { key: 'activity', label: '활동 (' + projActivity.length + ')' },
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

    // Activity panel (new)
    var activityHtml = '<div class="detail-panel" data-panel="activity" style="display:none">';
    if (projActivity.length === 0) {
      activityHtml += '<div class="empty-state">최근 활동이 없습니다.</div>';
    } else {
      activityHtml += projActivity.map(function (item) {
        var icon = activityIcon(item.type);
        var msg = escapeHtml((item.message || '').slice(0, 100));
        if (item.message && item.message.length > 100) msg += '…';
        var link = item.url ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener" class="activity-link">↗</a>' : '';
        return '<div class="activity-item">' +
          '<span class="activity-icon">' + icon + '</span>' +
          '<div class="activity-content">' +
            '<div class="activity-msg">' + msg + '</div>' +
            '<div class="activity-meta">' +
              '<span class="activity-author">👤 ' + escapeHtml(item.author || '') + '</span>' +
              '<span class="activity-time">' + timeAgo(item.date) + '</span>' +
            '</div>' +
          '</div>' +
          link +
        '</div>';
      }).join('');
    }
    activityHtml += '</div>';

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

    // Repos panel — enhanced with activity data
    var reposHtml = '<div class="detail-panel" data-panel="repos" style="display:none">';
    if (projRepos.length === 0) {
      reposHtml += '<div class="empty-state">등록된 리포가 없습니다.</div>';
    } else {
      reposHtml += '<div class="repo-list">' + projRepos.map(function (r) {
        var url = r.url || ('https://github.com/Daegu-Agent-Crew/' + r.slug);
        // Find matching activity data
        var repoActivity = null;
        if (_activityData && _activityData.repos) {
          var slugNorm = r.slug;
          _activityData.repos.forEach(function (ra) {
            if (ra.slug === slugNorm || ra.slug.indexOf(r.slug.split('/').pop()) !== -1) repoActivity = ra;
          });
        }

        var activityBadges = '';
        if (repoActivity) {
          if (repoActivity.open_prs > 0) activityBadges += '<span class="repo-badge repo-badge-pr">🔀 ' + repoActivity.open_prs + ' PR</span>';
          if (repoActivity.open_issues > 0) activityBadges += '<span class="repo-badge repo-badge-issue">❗ ' + repoActivity.open_issues + '</span>';
          if (repoActivity.pushed_at) activityBadges += '<span class="repo-badge repo-badge-time">⏱ ' + timeAgo(repoActivity.pushed_at) + '</span>';
        }

        var commits = '';
        if (repoActivity && repoActivity.recent_commits && repoActivity.recent_commits.length > 0) {
          commits = '<div class="repo-commits">' +
            repoActivity.recent_commits.slice(0, 3).map(function (c) {
              var cmsg = escapeHtml((c.message || '').slice(0, 80));
              if (c.message && c.message.length > 80) cmsg += '…';
              return '<div class="repo-commit"><code class="commit-sha">' + escapeHtml(c.sha) + '</code> <span class="commit-msg">' + cmsg + '</span> <span class="commit-author">' + escapeHtml(c.author || '') + '</span></div>';
            }).join('') +
          '</div>';
        }

        return '<div class="repo-item">' +
          '<div class="repo-slug">' +
            '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(r.slug) + '</a>' +
          '</div>' +
          '<div class="repo-role">' + escapeHtml(r.role || '') + '</div>' +
          '<div class="repo-card-badges">' + activityBadges + '</div>' +
          commits +
        '</div>';
      }).join('') + '</div>';
    }
    reposHtml += '</div>';

    // Assemble
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
          activityHtml +
          wikiHtml +
          tlHtml +
          tasksHtml +
          reposHtml +
        '</div>' +
      '</div>';

    var main = $('.dashboard-main');
    main.innerHTML = pageHtml;

    window.scrollTo(0, 0);

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

  // ── Dashboard page ──

  function renderDashboard() {
    var data = _dashboardData;
    if (!data) return;

    var main = $('.dashboard-main');

    // Build section HTML — now includes Activity Feed and Repositories
    var sections = '';

    // Overview
    sections += '<section id="overview" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">📊 팀 개요</h2><button class="help-btn" data-help="overview" aria-label="도움말">?</button></div>' +
      '<div class="stats-grid" id="stats-grid"></div>' +
    '</div></section>';

    // Activity Feed (new)
    sections += '<section id="activity" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">🔥 최근 활동</h2></div>' +
      '<p class="section-desc">최근 30일간의 커밋, PR 활동' +
      (_activityData ? ' · <span class="activity-updated">' + timeAgo(_activityData.generated) + ' 업데이트</span>' : '') +
      '</p>' +
      '<div id="activity-list" class="activity-list"></div>' +
    '</div></section>';

    // Repositories (new)
    sections += '<section id="repositories" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">🔗 리포지토리</h2></div>' +
      '<p class="section-desc">전체 리포지토리 현황 및 최근 커밋</p>' +
      '<div id="repos-list" class="repos-list"></div>' +
    '</div></section>';

    // Wiki
    sections += '<section id="wiki" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">📖 위키 요약</h2><button class="help-btn" data-help="wiki" aria-label="도움말">?</button></div>' +
      '<p class="section-desc">각 프로젝트의 현재 컨텍스트 요약</p>' +
      '<div id="wiki-content" class="wiki-container"></div>' +
    '</div></section>';

    // Timeline
    sections += '<section id="timeline" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">🕐 타임라인</h2><button class="help-btn" data-help="timeline" aria-label="도움말">?</button></div>' +
      '<p class="section-desc">팀 활동을 시간순으로 정리합니다</p>' +
      '<div id="timeline-list" class="timeline"></div>' +
      '<div id="no-timeline" class="empty-state" style="display:none">공개 기록이 없습니다.</div>' +
    '</div></section>';

    // Projects
    sections += '<section id="projects" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">🚀 프로젝트</h2><button class="help-btn" data-help="projects" aria-label="도움말">?</button></div>' +
      '<div id="projects-list" class="card-grid"></div>' +
    '</div></section>';

    // Tasks
    sections += '<section id="tasks" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">✅ 태스크</h2><button class="help-btn" data-help="tasks" aria-label="도움말">?</button></div>' +
      '<div id="tasks-list" class="task-list"></div>' +
      '<div id="no-tasks" class="empty-state" style="display:none">아직 추적 중인 태스크가 없습니다.</div>' +
    '</div></section>';

    // Decisions
    sections += '<section id="decisions" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">📜 결정 로그</h2><button class="help-btn" data-help="decisions" aria-label="도움말">?</button></div>' +
      '<p class="section-desc">팀의 결정과 그 배경을 기록합니다</p>' +
      '<div id="decisions-list" class="decision-list"></div>' +
      '<div id="no-decisions" class="empty-state" style="display:none">아직 기록된 결정이 없습니다.</div>' +
    '</div></section>';

    // Members
    sections += '<section id="members" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">👥 팀 멤버</h2><button class="help-btn" data-help="members" aria-label="도움말">?</button></div>' +
      '<div id="members-list" class="member-grid"></div>' +
    '</div></section>';

    // Records
    sections += '<section id="records" class="section"><div class="section-inner">' +
      '<div class="section-title-wrap"><h2 class="section-title">📂 전체 기록</h2><button class="help-btn" data-help="records" aria-label="도움말">?</button></div>' +
      '<div id="records-tabs" class="tab-bar"></div>' +
      '<div id="records-content" class="records-content"></div>' +
    '</div></section>';

    main.innerHTML =
      '<div id="loading" class="loading">불러오는 중...</div>' +
      '<div id="error" class="error" style="display:none"></div>' +
      '<div id="content" style="display:none">' + sections + '</div>';

    $('#loading').style.display = 'none';
    $('#content').style.display = 'block';

    var gen = data.generated ? data.generated.replace('T', ' ').replace('Z', ' UTC') : '';
    var genEl = $('#generated-time');
    if (genEl) genEl.textContent = gen;

    renderStats(data);
    renderActivityFeed();
    renderRepositories();
    renderWiki(data);
    renderTimeline(data);
    renderProjects(data);
    renderTasks(data);
    renderDecisions(data);
    renderMembers(data);
    renderRecords(data);
  }

  // ── Init ──

  function init(data, activity) {
    _dashboardData = data;
    _activityData = activity;
    handleRoute();
  }

  // ── Help Modal System (preserved) ──

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
        '</ol>'
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
        '<div class="warn">⚠️ 민감한 레코드에 <code>visibility: private</code> 추가 → 대시보드에서 제외됩니다.</div>'
    },
    projects: {
      title: '🚀 프로젝트 — 등록 및 관리',
      body: '<h4>' + HUMAN + ' 프로젝트 등록 지시</h4>' +
        '<div class="tip"><code>tm-load</code></div>' +
        '<p>새 프로젝트가 필요하면 에이전트에게 지시하세요.</p>' +
        '<h4>' + AGENT + ' 실행 워크플로</h4>' +
        '<ol>' +
        '<li><code>context/registry/projects/</code>에 YAML 작성</li>' +
        '<li><code>bin/memory-verify</code>로 검증</li>' +
        '</ol>'
    },
    tasks: {
      title: '✅ 태스크 — 추적 방법',
      body: '<h4>' + HUMAN + ' 태스크 생성 지시</h4>' +
        '<div class="tip"><code>tm-ingest</code></div>' +
        '<h4>태스크 레코드 프론트매터</h4>' +
        '<pre><code>task_phase: development\ntask_status: in-progress\nmilestone: M1\nassignee: normalkim\ndue: 2026-07-01</code></pre>'
    },
    decisions: {
      title: '📜 결정 로그 — 기록 방법',
      body: '<h4>' + HUMAN + ' 결정 기록 지시</h4>' +
        '<div class="tip"><code>tm-ingest</code></div>' +
        '<pre><code>decision_status: active</code></pre>'
    },
    members: {
      title: '👥 멤버 — 등록 방법',
      body: '<h4>' + HUMAN + ' 멤버 추가 지시</h4>' +
        '<div class="warn">⚠️ 멤버 추가는 <strong>반드시 사람이 승인</strong>해야 합니다.</div>' +
        '<h4>' + AGENT + ' 실행 워크플로 (승인 후)</h4>' +
        '<ol>' +
        '<li><code>.github/team-memory-members.yml</code>에 GitHub 아이디 추가</li>' +
        '<li><code>bin/memory-verify</code>로 검증</li>' +
        '</ol>'
    },
    records: {
      title: '📂 전체 기록 — 관리 방법',
      body: '<h4>기록 원칙</h4>' +
        '<p>모든 기록은 <strong>append-only</strong>입니다.</p>' +
        '<div class="tip">💡 <code>tm-sync</code> 스킬을 쓰면 verify + Git 상태를 한번에 확인합니다.</div>' +
        '<h4>공개/비공개 제어</h4>' +
        '<ul>' +
        '<li><code>visibility: private</code> → 대시보드에서 제외</li>' +
        '<li>visibility 필드 없음 → 기본 비공개</li>' +
        '<li><code>visibility: public</code> → 대시보드에 표시</li>' +
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
  window.addEventListener('hashchange', handleRoute);

  // Fetch both data files in parallel
  var dashPromise = fetch(DATA_PATH).then(function (res) {
    if (!res.ok) throw new Error('dashboard.json HTTP ' + res.status);
    return res.json();
  });

  var activityPromise = fetch(ACTIVITY_PATH)
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; });

  Promise.all([dashPromise, activityPromise])
    .then(function (results) {
      init(results[0], results[1]);
    })
    .catch(function (err) {
      var main = $('.dashboard-main');
      main.innerHTML = '<div class="error">대시보드 데이터를 불러오지 못했습니다: ' + escapeHtml(err.message) + '</div>';
    });
})();

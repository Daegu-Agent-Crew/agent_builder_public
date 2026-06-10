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

// Team Dashboard — dashboard.js

(function () {
  'use strict';

  const DATA_PATH = 'data/dashboard.json';

  // ── Helpers ──────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '';
    return d.slice(0, 10);
  }

  function statusBadge(status) {
    if (!status) return '';
    const cls = 'badge badge-' + status.toLowerCase().replace(/\s+/g, '-');
    return '<span class="' + cls + '">' + escapeHtml(status) + '</span>';
  }

  function taskIcon(status) {
    const icons = {
      'pending': '⏳',
      'in-progress': '🔄',
      'done': '✅',
      'blocked': '🚫'
    };
    return '<span class="task-status-icon ' + escapeHtml(status || 'pending') + '">' + (icons[status] || '⏳') + '</span>';
  }

  function decisionIcon(status) {
    const icons = {
      'active': '✅',
      'revised': '🔄',
      'superseded': '⏭️',
      'reverted': '↩️'
    };
    return '<span class="decision-icon">' + (icons[status] || '📜') + '</span>';
  }

  // ── Renderers ────────────────────────────────────────

  function renderStats(data) {
    const projectCount = (data.projects || []).length;
    const recordCount = Object.values(data.records_by_project || {})
      .reduce((sum, recs) => sum + recs.length, 0);
    const taskCount = (data.tasks || []).length;
    const memberCount = (data.members || []).length;

    const grid = $('#stats-grid');
    grid.innerHTML = [
      { value: projectCount, label: '프로젝트' },
      { value: recordCount, label: '기록' },
      { value: taskCount, label: '태스크' },
      { value: memberCount, label: '멤버' }
    ].map(function (s) {
      return '<div class="stat-card"><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div></div>';
    }).join('');
  }

  function renderProjects(data) {
    const projects = data.projects || [];
    const recsByProject = data.records_by_project || {};
    const repos = data.repositories || [];

    const container = $('#projects-list');
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

    // Sort: in-progress first, then pending, then blocked, then done
    var order = { 'in-progress': 0, 'pending': 1, 'blocked': 2, 'done': 3 };
    tasks.sort(function (a, b) {
      return (order[a.status] || 99) - (order[b.status] || 99);
    });

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
      return '<div class="decision-item">' +
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
      '</div>';
    }).join('');
  }

  function renderMembers(data) {
    var members = data.members || [];
    var container = $('#members-list');

    container.innerHTML = members.map(function (m) {
      var initial = m.charAt(0).toUpperCase();
      return '<div class="member-card">' +
        '<div class="member-avatar">' + escapeHtml(initial) + '</div>' +
        '<div class="member-name">' + escapeHtml(m) + '</div>' +
        '<div class="member-handle">@' + escapeHtml(m) + '</div>' +
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

    // Build tabs
    tabBar.innerHTML = projects.map(function (p, i) {
      return '<button class="tab-btn' + (i === 0 ? ' active' : '') + '" data-project="' + escapeHtml(p.id) + '">' +
        escapeHtml(p.name || p.id) +
        ' (' + (recsByProject[p.id] || []).length + ')' +
      '</button>';
    }).join('');

    function showProject(projectId) {
      var recs = recsByProject[projectId] || [];
      if (recs.length === 0) {
        content.innerHTML = '<div class="empty-state">이 프로젝트에 기록이 없습니다.</div>';
        return;
      }

      // Show newest first
      var sorted = recs.slice().reverse();
      content.innerHTML = sorted.map(function (r) {
        return '<div class="record-item">' +
          '<span class="record-date">' + formatDate(r.date) + '</span>' +
          '<span class="record-title">' + escapeHtml(r.title) + '</span>' +
          '<span class="record-source">' + escapeHtml(r.member || '') + ' · ' + escapeHtml(r.source_type || '') + '</span>' +
        '</div>';
      }).join('');
    }

    // Initial render
    showProject(projects[0].id);

    // Tab clicks
    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      $$('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      showProject(btn.dataset.project);
    });
  }

  // ── Init ─────────────────────────────────────────────

  function init(data) {
    $('#loading').style.display = 'none';
    $('#content').style.display = 'block';

    // Format generated time
    var gen = data.generated ? data.generated.replace('T', ' ').replace('Z', ' UTC') : '';
    $('#generated-time').textContent = gen;

    renderStats(data);
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

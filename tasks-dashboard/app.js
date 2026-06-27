/* ============================================================
   Agent Builder — 스터디 미션 대시보드 SPA
   CLE2 SPA 패턴 기반, 커뮤니티 맞춤 분기
   ============================================================ */

(function () {
  'use strict';

  /* ====== Constants ====== */
  var STORAGE_KEY = 'ab_tasks';
  var SETTINGS_KEY = 'ab_settings';
  var DATA_VERSION = 'v1';
  var VERSION_KEY = 'ab_data_version';

  var MISSION_STATUS = {
    'not-started': { label: '미시작', cls: 'badge-pending', icon: '⏸️' },
    'in-progress': { label: '진행 중', cls: 'badge-active', icon: '🔄' },
    'submitted': { label: '제출 완료', cls: 'badge-done', icon: '✅' },
    'reviewed': { label: '리뷰 완료', cls: 'badge-done', icon: '🎯' }
  };

  var MEMBERS = [
    { id: 'sfex11', name: 'sfex11', role: 'PD / 회장님', avatar: '🎬' },
    { id: 'normalkim', name: 'normalkim', role: '이미지 / 스타일', avatar: '🎨' },
    { id: 'eugene', name: 'eugene', role: '대본 / 이미지', avatar: '✍️' },
    { id: 'junteken', name: 'junteken', role: '대본 / 이미지', avatar: '📝' },
    { id: 'YoonJongHyuk', name: 'YoonJongHyuk', role: '이미지 생성', avatar: '🖼️' }
  ];

  /* ====== Seed Data ====== */
  var SEED_MISSIONS = [
    { id: 'AB-1', title: 'Starter Kit 온보딩', week: 0, status: 'in-progress', assignee: '대구루', desc: 'Starter Kit 가이드 재구성', issue: null },
    { id: 'AB-2', title: '스터디 미션 워크플로우', week: 0, status: 'not-started', assignee: '대구루', desc: '미션 라이프사이클 정의', issue: null }
  ];

  var SEED_WIKI = [
    { id: 'starter-kit', title: 'Starter Kit', category: '가이드', tags: ['온보딩', 'Obsidian'], content: 'Obsidian + Claude Code 기반 팀 운영 시스템. 미션 제출 → 분석 → 배포 파이프라인.' },
    { id: 'cle2-pattern', title: 'CLE2 태스크 패턴', category: '구조', tags: ['CLE2', 'tasks'], content: 'GOAL/PLAN/STATUS/TESTS 4문서 관리. 이슈 → 태스크 매핑.' },
    { id: 'team-memory', title: 'team-memory', category: '시스템', tags: ['memory', 'context'], content: '공유 메모리 시스템. records → registry → wiki 파이프라인.' }
  ];

  /* ====== State ====== */
  var state = {
    page: 'home',
    missions: [],
    wiki: [],
    settings: {},
    filter: 'all',
    search: ''
  };

  /* ====== Init ====== */
  function init() {
    loadData();
    if (!state.missions.length) { state.missions = JSON.parse(JSON.stringify(SEED_MISSIONS)); saveData(); }
    if (!state.wiki.length) { state.wiki = JSON.parse(JSON.stringify(SEED_WIKI)); saveData(); }
    render();
  }

  function loadData() {
    try {
      var ver = localStorage.getItem(VERSION_KEY);
      if (ver !== DATA_VERSION) { localStorage.removeItem(STORAGE_KEY); localStorage.setItem(VERSION_KEY, DATA_VERSION); }
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) { var d = JSON.parse(s); state.missions = d.missions || []; state.wiki = d.wiki || []; }
      var settings = localStorage.getItem(SETTINGS_KEY);
      state.settings = settings ? JSON.parse(settings) : { githubRepo: '', vaultPath: '' };
    } catch(e) {}
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ missions: state.missions, wiki: state.wiki }));
    } catch(e) {}
  }

  /* ====== Router ====== */
  function navigate(page) { state.page = page; render(); }

  /* ====== Render ====== */
  function render() {
    var app = document.getElementById('app');
    app.innerHTML = nav() + '<div class="container">' + pageContent() + '</div>';
    bindEvents();
  }

  function nav() {
    var pages = [
      { id: 'home', label: '🏠 홈' },
      { id: 'missions', label: '🎯 미션' },
      { id: 'submit', label: '📝 제출' },
      { id: 'members', label: '👥 멤버' },
      { id: 'wiki', label: '📚 위키' },
      { id: 'settings', label: '⚙️ 설정' }
    ];
    var items = pages.map(function(p) {
      return '<span class="nav-item ' + (state.page === p.id ? 'active' : '') + '" data-page="' + p.id + '">' + p.label + '</span>';
    }).join('');
    return '<nav class="navbar"><span class="nav-brand" data-page="home">📋 미션 대시보드</span>' + items + '</nav>';
  }

  function pageContent() {
    switch(state.page) {
      case 'home': return pageHome();
      case 'missions': return pageMissions();
      case 'submit': return pageSubmit();
      case 'members': return pageMembers();
      case 'wiki': return pageWiki();
      case 'settings': return pageSettings();
      default: return pageHome();
    }
  }

  /* ====== Home ====== */
  function pageHome() {
    var total = state.missions.length;
    var inProgress = state.missions.filter(function(m) { return m.status === 'in-progress'; }).length;
    var done = state.missions.filter(function(m) { return m.status === 'submitted' || m.status === 'reviewed'; }).length;
    var notStarted = state.missions.filter(function(m) { return m.status === 'not-started'; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;

    return '<h2 class="section-title">스터디 현황</h2>' +
      '<div class="stats-row">' +
        statBox(total, '전체 미션') +
        statBox(inProgress, '진행 중') +
        statBox(done, '완료') +
        statBox(pct + '%', '진행률') +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<h2 class="section-title" style="margin-top:32px">최근 미션</h2>' +
      missionList(state.missions.slice(0, 5));
  }

  function statBox(num, label) {
    return '<div class="stat-box"><div class="stat-num">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  /* ====== Missions ====== */
  function pageMissions() {
    var filters = [
      { id: 'all', label: '전체' },
      { id: 'not-started', label: '미시작' },
      { id: 'in-progress', label: '진행 중' },
      { id: 'submitted', label: '제출 완료' },
      { id: 'reviewed', label: '리뷰 완료' }
    ];
    var chips = filters.map(function(f) {
      return '<span class="filter-chip ' + (state.filter === f.id ? 'active' : '') + '" data-filter="' + f.id + '">' + f.label + '</span>';
    }).join('');

    var filtered = state.filter === 'all' ? state.missions : state.missions.filter(function(m) { return m.status === state.filter; });

    if (state.search) {
      var q = state.search.toLowerCase();
      filtered = filtered.filter(function(m) { return m.title.toLowerCase().indexOf(q) >= 0 || m.id.toLowerCase().indexOf(q) >= 0; });
    }

    return '<h2 class="section-title">주차별 미션</h2>' +
      '<input class="search-box" id="mission-search" placeholder="🔍 미션 검색..." value="' + esc(state.search) + '">' +
      '<div class="filter-row">' + chips + '</div>' +
      missionList(filtered);
  }

  function missionList(items) {
    if (!items.length) return '<div class="empty-state">📭 미션이 없습니다</div>';
    return items.map(function(m) {
      var st = MISSION_STATUS[m.status] || MISSION_STATUS['not-started'];
      return '<div class="mission-item">' +
        '<span style="font-size:20px">' + st.icon + '</span>' +
        '<div style="flex:1">' +
          '<div style="font-weight:600">' + esc(m.id) + ': ' + esc(m.title) + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + esc(m.desc || '') + '</div>' +
        '</div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
      '</div>';
    }).join('');
  }

  /* ====== Submit ====== */
  function pageSubmit() {
    var opts = state.missions.map(function(m) {
      return '<option value="' + esc(m.id) + '">' + esc(m.id) + ': ' + esc(m.title) + '</option>';
    }).join('');

    return '<h2 class="section-title">미션 제출</h2>' +
      '<div class="card">' +
        '<div class="form-group"><label class="form-label">미션</label><select class="form-select" id="submit-mission"><option value="">선택...</option>' + opts + '</select></div>' +
        '<div class="form-group"><label class="form-label">제출자</label><select class="form-select" id="submit-member">' +
          MEMBERS.map(function(m) { return '<option value="' + m.id + '">' + m.avatar + ' ' + esc(m.name) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">제출 내용 요약</label><textarea class="form-textarea" id="submit-content" placeholder="미션 제출 내용을 요약해주세요"></textarea></div>' +
        '<button class="btn btn-primary" id="submit-btn">제출하기</button>' +
      '</div>' +
      '<p style="margin-top:12px;color:var(--text-muted);font-size:13px">💡 실제 제출은 Obsidian vault의 <code>00_missions/Week_N_submit/</code> 폴더에 작성해주세요. 이 폼은 기록용입니다.</p>';
  }

  /* ====== Members ====== */
  function pageMembers() {
    return '<h2 class="section-title">팀원 현황</h2>' +
      '<div class="card-grid">' +
        MEMBERS.map(function(m) {
          var missionCount = state.missions.filter(function(mi) { return mi.assignee === m.name; }).length;
          return '<div class="member-card">' +
            '<span class="member-avatar">' + m.avatar + '</span>' +
            '<div><div class="member-name">' + esc(m.name) + '</div>' +
            '<div class="member-role">' + esc(m.role) + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">할당 미션: ' + missionCount + '개</div></div>' +
          '</div>';
        }).join('') +
      '</div>';
  }

  /* ====== Wiki ====== */
  function pageWiki() {
    return '<h2 class="section-title">스터디 위키</h2>' +
      '<input class="search-box" id="wiki-search" placeholder="🔍 위키 검색...">' +
      '<div id="wiki-list">' + wikiList(state.wiki) + '</div>';
  }

  function wikiList(items) {
    if (!items.length) return '<div class="empty-state">📚 위키 문서가 없습니다</div>';
    return items.map(function(w) {
      return '<div class="wiki-entry">' +
        '<div style="font-weight:600;margin-bottom:4px">' + esc(w.title) + '</div>' +
        '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">' +
          '<span class="badge badge-mission">' + esc(w.category) + '</span> ' +
          (w.tags || []).map(function(t) { return '<span class="wiki-tag">' + esc(t) + '</span>'; }).join('') +
        '</div>' +
        '<div style="font-size:14px;color:var(--text-muted)">' + esc(w.content) + '</div>' +
      '</div>';
    }).join('');
  }

  /* ====== Settings ====== */
  function pageSettings() {
    var s = state.settings;
    return '<h2 class="section-title">설정</h2>' +
      '<div class="card">' +
        '<div class="form-group"><label class="form-label">GitHub 리포</label><input class="form-input" id="set-repo" value="' + esc(s.githubRepo || '') + '" placeholder="Daegu-Agent-Crew/agent_builder_public"></div>' +
        '<div class="form-group"><label class="form-label">Obsidian Vault 경로</label><input class="form-input" id="set-vault" value="' + esc(s.vaultPath || '') + '" placeholder="~/github/my-team-vault"></div>' +
        '<button class="btn btn-primary" id="settings-save">저장</button>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<h3 style="margin-bottom:12px">데이터 관리</h3>' +
        '<button class="btn btn-secondary" id="data-export">📤 내보내기 (JSON)</button> ' +
        '<button class="btn btn-secondary" id="data-reset" style="margin-left:8px">🔄 초기화</button>' +
      '</div>';
  }

  /* ====== Events ====== */
  function bindEvents() {
    // Nav
    var navItems = document.querySelectorAll('.nav-item, .nav-brand');
    navItems.forEach(function(el) {
      el.onclick = function() { navigate(el.getAttribute('data-page')); };
    });

    // Filter
    var chips = document.querySelectorAll('.filter-chip');
    chips.forEach(function(el) {
      el.onclick = function() { state.filter = el.getAttribute('data-filter'); render(); };
    });

    // Search
    var ms = document.getElementById('mission-search');
    if (ms) { ms.oninput = function() { state.search = ms.value; pageMissionsRerender(); }; }
    var ws = document.getElementById('wiki-search');
    if (ws) { ws.oninput = function() {
      var q = ws.value.toLowerCase();
      var filtered = state.wiki.filter(function(w) {
        return w.title.toLowerCase().indexOf(q) >= 0 || (w.content && w.content.toLowerCase().indexOf(q) >= 0);
      });
      document.getElementById('wiki-list').innerHTML = wikiList(filtered);
    }; }

    // Submit
    var sb = document.getElementById('submit-btn');
    if (sb) { sb.onclick = function() {
      var mid = document.getElementById('submit-mission').value;
      if (!mid) { alert('미션을 선택하세요'); return; }
      var m = state.missions.find(function(x) { return x.id === mid; });
      if (m) { m.status = 'submitted'; saveData(); alert('제출 완료!'); navigate('missions'); }
    }; }

    // Settings
    var sv = document.getElementById('settings-save');
    if (sv) { sv.onclick = function() {
      state.settings.githubRepo = document.getElementById('set-repo').value;
      state.settings.vaultPath = document.getElementById('set-vault').value;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch(e) {}
      alert('저장되었습니다');
    }; }

    var de = document.getElementById('data-export');
    if (de) { de.onclick = function() {
      var blob = new Blob([JSON.stringify({ missions: state.missions, wiki: state.wiki }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ab-tasks.json'; a.click();
    }; }

    var dr = document.getElementById('data-reset');
    if (dr) { dr.onclick = function() {
      if (confirm('모든 데이터를 초기화합니다')) {
        localStorage.removeItem(STORAGE_KEY); state.missions = []; state.wiki = []; init();
      }
    }; }
  }

  function pageMissionsRerender() {
    // Re-render missions page content only
    var container = document.querySelector('.container');
    if (container && state.page === 'missions') { container.innerHTML = pageMissions(); bindEvents(); }
  }

  /* ====== Utils ====== */
  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ====== Boot ====== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

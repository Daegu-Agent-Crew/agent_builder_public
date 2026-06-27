/* ============================================================
   Agent Builder — 미션 대시보드 SPA
   팀 대시보드 디자인 + GitHub 연동 강화 (CLE2 패턴 참고)
   ============================================================ */

(function () {
  'use strict';

  /* ====== Constants ====== */
  var STORAGE_KEY = 'ab_tasks';
  var SETTINGS_KEY = 'ab_settings';
  var DATA_VERSION = 'v2';
  var VERSION_KEY = 'ab_data_version';

  var ORG = 'Daegu-Agent-Crew';
  var DEFAULT_REPO = 'agent_builder_public';

  var MISSION_STATUS = {
    'not-started': { label: '미시작', cls: 'badge-not-started', icon: '⏸️' },
    'in-progress': { label: '진행 중', cls: 'badge-in-progress', icon: '🔄' },
    'submitted': { label: '제출 완료', cls: 'badge-submitted', icon: '✅' },
    'reviewed': { label: '리뷰 완료', cls: 'badge-reviewed', icon: '🎯' }
  };

  var MEMBERS = [
    { id: 'sfex11', name: 'sfex11', role: 'PD / 회장님', avatar: '🎬' },
    { id: 'normalkim', name: 'normalkim', role: '이미지 / 스타일', avatar: '🎨' },
    { id: 'eugene', name: 'eugene', role: '대본 / 이미지', avatar: '✍️' },
    { id: 'junteken', name: 'junteken', role: '대본 / 이미지', avatar: '📝' },
    { id: 'YoonJongHyuk', name: 'YoonJongHyuk', role: '이미지 생성', avatar: '🖼️' },
    { id: 'daeguru', name: '대구루', role: 'AI 비서 / 개발', avatar: '🤖' }
  ];

  /* ====== Seed Data ====== */
  var SEED_MISSIONS = [
    { id: 'AB-1', title: 'Starter Kit 온보딩', week: 0, status: 'in-progress', assignee: '대구루', desc: 'Starter Kit 가이드 재구성', issue: null, pr: null, githubSynced: false },
    { id: 'AB-2', title: '스터디 미션 워크플로우', week: 0, status: 'not-started', assignee: '대구루', desc: '미션 라이프사이클 정의', issue: null, pr: null, githubSynced: false }
  ];

  var SEED_WIKI = [
    { id: 'starter-kit', title: 'Starter Kit', category: '가이드', tags: ['온보딩', 'Obsidian'], content: 'Obsidian + Claude Code 기반 팀 운영 시스템. 미션 제출 → 분석 → 배포 파이프라인.' },
    { id: 'cle2-pattern', title: 'CLE2 태스크 패턴', category: '구조', tags: ['CLE2', 'tasks'], content: 'GOAL/PLAN/STATUS/TESTS 4문서 관리. 이슈 → 태스크 매핑. GitHub Actions 자동 상태 업데이트.' },
    { id: 'team-memory', title: 'team-memory', category: '시스템', tags: ['memory', 'context'], content: '공유 메모리 시스템. records → registry → wiki 파이프라인.' },
    { id: 'github-sync', title: 'GitHub 연동', category: '기능', tags: ['GitHub', 'API'], content: 'GitHub Issues/PR과 미션 상태 양방향 동기화. 이슈 생성 → 미션 자동 추가, PR 머지 → 상태 자동 업데이트.' }
  ];

  /* ====== State ====== */
  var state = {
    page: 'home',
    missions: [],
    wiki: [],
    settings: {},
    githubIssues: [],
    githubLoading: false,
    githubError: null,
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
      if (ver !== DATA_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(VERSION_KEY, DATA_VERSION);
      }
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        var d = JSON.parse(s);
        state.missions = d.missions || [];
        state.wiki = d.wiki || [];
      }
      var settings = localStorage.getItem(SETTINGS_KEY);
      state.settings = settings ? JSON.parse(settings) : {
        githubRepo: ORG + '/' + DEFAULT_REPO,
        githubToken: '',
        vaultPath: ''
      };
    } catch(e) {}
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ missions: state.missions, wiki: state.wiki }));
    } catch(e) {}
  }

  /* ====== GitHub API ====== */
  function githubApi(path, method, body) {
    var repo = state.settings.githubRepo || (ORG + '/' + DEFAULT_REPO);
    var url = 'https://api.github.com/repos/' + repo + path;
    var headers = {
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    if (state.settings.githubToken) {
      headers['Authorization'] = 'Bearer ' + state.settings.githubToken;
    }

    var opts = { method: method || 'GET', headers: headers };
    if (body) opts.body = JSON.stringify(body);

    return fetch(url, opts).then(function(r) {
      if (!r.ok) throw new Error('GitHub API error: ' + r.status);
      return r.json();
    });
  }

  function fetchGithubIssues() {
    state.githubLoading = true;
    state.githubError = null;
    renderGithubSection();

    githubApi('/issues?state=all&per_page=30&sort=created&direction=desc')
      .then(function(issues) {
        state.githubIssues = issues.filter(function(i) {
          return !i.pull_request;
        });
        state.githubLoading = false;
        // Auto-link issues to missions by AB-N pattern
        syncMissionsFromGithub();
        renderGithubSection();
      })
      .catch(function(err) {
        state.githubLoading = false;
        state.githubError = err.message;
        renderGithubSection();
      });
  }

  function syncMissionsFromGithub() {
    state.githubIssues.forEach(function(issue) {
      var match = (issue.title || '').match(/\[?(AB-\d+)\]?/i);
      if (!match) return;
      var missionId = match[1].toUpperCase();
      var existing = state.missions.find(function(m) { return m.id === missionId; });
      if (existing) {
        existing.issue = issue.number;
        existing.githubSynced = true;
        // Auto-update status from issue state
        if (issue.state === 'closed' && existing.status !== 'reviewed') {
          existing.status = 'submitted';
        }
      } else {
        // Auto-create mission from issue
        var title = issue.title.replace(/^\[?AB-\d+\]?\s*/i, '');
        state.missions.push({
          id: missionId,
          title: title,
          week: 0,
          status: issue.state === 'closed' ? 'submitted' : 'in-progress',
          assignee: (issue.assignee && issue.assignee.login) || '미배정',
          desc: (issue.body || '').split('\n')[0].substring(0, 100),
          issue: issue.number,
          pr: null,
          githubSynced: true
        });
      }
    });
    saveData();
  }

  function createGithubIssue(mission) {
    var body = [
      '## 미션: ' + mission.title,
      '',
      mission.desc || '',
      '',
      '---',
      '**미션 ID:** ' + mission.id,
      '**담당자:** ' + mission.assignee,
      '**상태:** ' + (MISSION_STATUS[mission.status] || {}).label,
      '',
      '> 이 이슈는 미션 대시보드에서 자동 생성되었습니다.'
    ].join('\n');

    githubApi('/issues', 'POST', {
      title: '[' + mission.id + '] ' + mission.title,
      body: body,
      labels: ['mission']
    }).then(function(issue) {
      mission.issue = issue.number;
      mission.githubSynced = true;
      saveData();
      alert('GitHub 이슈 #' + issue.number + ' 가 생성되었습니다.');
      render();
    }).catch(function(err) {
      alert('이슈 생성 실패: ' + err.message);
    });
  }

  function updateMissionStatusOnGithub(mission) {
    if (!mission.issue) return;
    var commentBody = '📊 **상태 업데이트:** ' + (MISSION_STATUS[mission.status] || {}).label +
      '\n> 미션 대시보드에서 상태가 변경되었습니다.';
    githubApi('/issues/' + mission.issue + '/comments', 'POST', { body: commentBody })
      .catch(function(err) {
        console.error('Status update failed:', err);
      });
  }

  /* ====== Router ====== */
  function navigate(page) { state.page = page; render(); }

  /* ====== Render ====== */
  function render() {
    var app = document.getElementById('app');
    app.innerHTML = header() + '<main class="dashboard-main">' + pageContent() + '</main>' + footer();
    bindEvents();
  }

  function header() {
    var pages = [
      { id: 'home', label: '🏠 홈' },
      { id: 'missions', label: '🎯 미션' },
      { id: 'submit', label: '📝 제출' },
      { id: 'github', label: '🔗 GitHub' },
      { id: 'members', label: '👥 멤버' },
      { id: 'wiki', label: '📚 위키' },
      { id: 'settings', label: '⚙️ 설정' }
    ];
    var items = pages.map(function(p) {
      return '<span class="nav-item ' + (state.page === p.id ? 'active' : '') + '" data-page="' + p.id + '">' + p.label + '</span>';
    }).join('');

    return '<header class="site-header">' +
      '<div class="header-inner">' +
        '<a class="logo" data-page="home">📋 미션 대시보드</a>' +
        '<nav class="desktop-nav">' +
          items +
          '<a class="cross-link" href="../dashboard/">📋 팀 대시보드 →</a>' +
        '</nav>' +
      '</div>' +
    '</header>';
  }

  function footer() {
    return '<footer class="site-footer">' +
      '<div class="footer-inner">' +
        '<p>Daegu Agent Crew · 미션 대시보드 · <a href="../dashboard/">팀 대시보드</a> · <a href="https://github.com/Daegu-Agent-Crew/agent_builder_public">GitHub</a></p>' +
      '</div>' +
    '</footer>';
  }

  function pageContent() {
    switch(state.page) {
      case 'home': return pageHome();
      case 'missions': return pageMissions();
      case 'submit': return pageSubmit();
      case 'github': return pageGithub();
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

    var syncedCount = state.missions.filter(function(m) { return m.githubSynced; }).length;

    return section('📊', '스터디 현황',
      '<div class="stats-grid">' +
        statCard(total, '전체 미션') +
        statCard(inProgress, '진행 중') +
        statCard(done, '완료') +
        statCard(pct + '%', '진행률') +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      (syncedCount > 0 ? '<p style="margin-top:12px;font-size:0.8rem;color:var(--text-muted)">🔗 GitHub 연동: ' + syncedCount + '개 미션</p>' : '')
    ) +
    section('🎯', '최근 미션', missionList(state.missions.slice(0, 5)));
  }

  function statCard(num, label) {
    return '<div class="stat-card"><div class="stat-value">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function section(icon, title, content) {
    return '<section class="section">' +
      '<div class="section-title-wrap"><h2 class="section-title">' + icon + ' ' + title + '</h2></div>' +
      content +
    '</section>';
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
      filtered = filtered.filter(function(m) {
        return m.title.toLowerCase().indexOf(q) >= 0 || m.id.toLowerCase().indexOf(q) >= 0;
      });
    }

    return section('🎯', '주차별 미션',
      '<input class="search-box" id="mission-search" placeholder="🔍 미션 검색..." value="' + esc(state.search) + '">' +
      '<div class="filter-row">' + chips + '</div>' +
      missionList(filtered)
    );
  }

  function missionList(items) {
    if (!items.length) return '<div class="empty-state">📭 미션이 없습니다</div>';
    return '<div class="mission-list">' + items.map(function(m) {
      var st = MISSION_STATUS[m.status] || MISSION_STATUS['not-started'];
      return '<div class="mission-item" data-mission="' + esc(m.id) + '">' +
        '<span class="mission-status-icon ' + (m.status || 'not-started') + '">' + st.icon + '</span>' +
        '<div class="mission-info">' +
          '<div class="mission-title">' + esc(m.id) + ': ' + esc(m.title) + '</div>' +
          '<div class="mission-meta">' +
            '<span>' + esc(m.desc || '') + '</span>' +
            (m.assignee ? '<span>👤 ' + esc(m.assignee) + '</span>' : '') +
            (m.issue ? '<a class="mission-issue-link" href="https://github.com/' + (state.settings.githubRepo || ORG + '/' + DEFAULT_REPO) + '/issues/' + m.issue + '" target="_blank">#' + m.issue + '</a>' : '') +
            (m.githubSynced ? '<span style="color:var(--green)">🔗 동기화됨</span>' : '') +
          '</div>' +
        '</div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* ====== Submit ====== */
  function pageSubmit() {
    var opts = state.missions.map(function(m) {
      return '<option value="' + esc(m.id) + '">' + esc(m.id) + ': ' + esc(m.title) + '</option>';
    }).join('');

    return section('📝', '미션 제출',
      '<div class="card">' +
        '<div class="form-group"><label class="form-label">미션</label><select class="form-select" id="submit-mission"><option value="">선택...</option>' + opts + '</select></div>' +
        '<div class="form-group"><label class="form-label">제출자</label><select class="form-select" id="submit-member">' +
          MEMBERS.map(function(m) { return '<option value="' + m.id + '">' + m.avatar + ' ' + esc(m.name) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">제출 내용 요약</label><textarea class="form-textarea" id="submit-content" placeholder="미션 제출 내용을 요약해주세요"></textarea></div>' +
        '<div class="form-group"><label class="form-label">GitHub PR (선택)</label><input class="form-input" id="submit-pr" placeholder="https://github.com/.../pull/123"></div>' +
        '<button class="btn btn-primary" id="submit-btn">제출하기</button>' +
      '</div>' +
      '<p style="margin-top:12px;color:var(--text-muted);font-size:0.8rem">💡 실제 제출은 Obsidian vault의 <code>00_missions/Week_N_submit/</code> 폴더에도 작성해주세요. PR 링크를 입력하면 GitHub와 연동됩니다.</p>'
    );
  }

  /* ====== GitHub Sync Page ====== */
  function pageGithub() {
    var repo = state.settings.githubRepo || (ORG + '/' + DEFAULT_REPO);
    var syncIcon = state.githubLoading ? '🔄' : (state.githubError ? '⚠️' : (state.githubIssues.length ? '✅' : '🔗'));
    var syncCls = state.githubError ? 'offline' : 'synced';
    var syncText = state.githubLoading ? '불러오는 중...' :
                   state.githubError ? '오류: ' + state.githubError :
                   state.githubIssues.length + '개 이슈 로드됨';

    var issuesHtml = '';
    if (state.githubIssues.length) {
      issuesHtml = state.githubIssues.map(function(issue) {
        var match = (issue.title || '').match(/\[?(AB-\d+)\]?/i);
        var missionId = match ? match[1].toUpperCase() : null;
        var linkedMission = missionId ? state.missions.find(function(m) { return m.id === missionId; }) : null;
        return '<div class="github-issue-item">' +
          '<span class="github-issue-num">#' + issue.number + '</span>' +
          '<span class="github-issue-title">' + esc(issue.title || '') + '</span>' +
          (linkedMission ? '<span class="badge badge-active">🔗 ' + esc(linkedMission.id) + '</span>' : '') +
          '<span class="github-issue-state ' + (issue.state === 'open' ? 'open' : 'closed') + '">' + (issue.state === 'open' ? '열림' : '닫힘') + '</span>' +
        '</div>';
      }).join('');
    } else if (!state.githubLoading) {
      issuesHtml = '<div class="empty-state">📥 GitHub 이슈가 없습니다. "동기화" 버튼을 눌러 불러오세요.</div>';
    }

    var unsyncedMissions = state.missions.filter(function(m) { return !m.issue; });

    return section('🔗', 'GitHub 연동',
      '<div class="github-sync-card">' +
        '<div class="github-sync-status">' +
          '<span class="github-sync-icon ' + syncCls + '">' + syncIcon + '</span>' +
          '<span>' + esc(syncText) + '</span>' +
          '<span style="margin-left:auto;font-size:0.8rem;color:var(--text-muted)">' + esc(repo) + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:20px">' +
          '<button class="btn btn-primary" id="github-sync-btn">' + (state.githubLoading ? '⏳ 동기화 중...' : '🔄 동기화') + '</button>' +
          '<button class="btn btn-secondary" id="github-create-all-btn"' + (unsyncedMissions.length ? '' : ' disabled') + '>📤 미연동 미션 이슈 생성 (' + unsyncedMissions.length + ')</button>' +
        '</div>' +
        '<div id="github-issues-list">' + issuesHtml + '</div>' +
      '</div>' +
      (unsyncedMissions.length ?
        section('📤', 'GitHub 미연동 미션',
          '<div class="mission-list">' + unsyncedMissions.map(function(m) {
            var st = MISSION_STATUS[m.status] || MISSION_STATUS['not-started'];
            return '<div class="mission-item">' +
              '<span class="mission-status-icon ' + (m.status || 'not-started') + '">' + st.icon + '</span>' +
              '<div class="mission-info">' +
                '<div class="mission-title">' + esc(m.id) + ': ' + esc(m.title) + '</div>' +
                '<div class="mission-meta"><span>' + esc(m.desc || '') + '</span></div>' +
              '</div>' +
              '<button class="btn btn-secondary" style="font-size:0.8rem;padding:6px 12px" data-create-issue="' + esc(m.id) + '">📤 이슈 생성</button>' +
            '</div>';
          }).join('') + '</div>'
        ) : ''
      )
    );
  }

  function renderGithubSection() {
    // Re-render only if on github page
    if (state.page !== 'github') return;
    var main = document.querySelector('.dashboard-main');
    if (main) { main.innerHTML = pageGithub(); bindEvents(); }
  }

  /* ====== Members ====== */
  function pageMembers() {
    return section('👥', '팀원 현황',
      '<div class="member-grid">' +
        MEMBERS.map(function(m) {
          var missionCount = state.missions.filter(function(mi) { return mi.assignee === m.name || mi.assignee === m.id; }).length;
          return '<div class="member-card">' +
            '<span class="member-avatar">' + m.avatar + '</span>' +
            '<div class="member-name">' + esc(m.name) + '</div>' +
            '<div class="member-role">' + esc(m.role) + '</div>' +
            '<div class="member-stat">할당 미션: ' + missionCount + '개</div>' +
          '</div>';
        }).join('') +
      '</div>'
    );
  }

  /* ====== Wiki ====== */
  function pageWiki() {
    return section('📚', '스터디 위키',
      '<input class="search-box" id="wiki-search" placeholder="🔍 위키 검색...">' +
      '<div id="wiki-list">' + wikiList(state.wiki) + '</div>'
    );
  }

  function wikiList(items) {
    if (!items.length) return '<div class="empty-state">📚 위키 문서가 없습니다</div>';
    return items.map(function(w) {
      return '<div class="wiki-entry">' +
        '<h3>' + esc(w.title) + '</h3>' +
        '<div style="margin-bottom:8px">' +
          '<span class="badge badge-mission">' + esc(w.category) + '</span> ' +
          (w.tags || []).map(function(t) { return '<span class="wiki-tag">' + esc(t) + '</span>'; }).join('') +
        '</div>' +
        '<div class="wiki-body">' + esc(w.content) + '</div>' +
      '</div>';
    }).join('');
  }

  /* ====== Settings ====== */
  function pageSettings() {
    var s = state.settings;
    return section('⚙️', '설정',
      '<div class="card">' +
        '<div class="form-group"><label class="form-label">GitHub 리포</label><input class="form-input" id="set-repo" value="' + esc(s.githubRepo || '') + '" placeholder="Daegu-Agent-Crew/agent_builder_public"></div>' +
        '<div class="form-group"><label class="form-label">GitHub Token (선택)</label><input class="form-input" id="set-token" type="password" value="' + esc(s.githubToken || '') + '" placeholder="ghp_... (높은 API 한도)"></div>' +
        '<div class="form-group"><label class="form-label">Obsidian Vault 경로</label><input class="form-input" id="set-vault" value="' + esc(s.vaultPath || '') + '" placeholder="~/github/my-team-vault"></div>' +
        '<button class="btn btn-primary" id="settings-save">저장</button>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<h3 style="margin-bottom:12px;font-size:1rem">데이터 관리</h3>' +
        '<button class="btn btn-secondary" id="data-export">📤 내보내기 (JSON)</button> ' +
        '<button class="btn btn-secondary" id="data-reset" style="margin-left:8px">🔄 초기화</button>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<h3 style="margin-bottom:8px;font-size:1rem">🔗 다른 대시보드</h3>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px">팀 전체 현황을 보려면 팀 대시보드를 방문하세요.</p>' +
        '<a class="cross-link" href="../dashboard/">📋 팀 대시보드로 이동 →</a>' +
      '</div>'
    );
  }

  /* ====== Events ====== */
  function bindEvents() {
    // Nav
    var navItems = document.querySelectorAll('.nav-item, .logo');
    navItems.forEach(function(el) {
      if (el.tagName === 'A' && el.getAttribute('href')) return; // skip real links
      el.onclick = function() {
        var page = el.getAttribute('data-page');
        if (page) navigate(page);
      };
    });

    // Mission click - cycle status
    var missionItems = document.querySelectorAll('.mission-item[data-mission]');
    missionItems.forEach(function(el) {
      el.onclick = function() {
        var id = el.getAttribute('data-mission');
        var m = state.missions.find(function(x) { return x.id === id; });
        if (m) {
          var statuses = ['not-started', 'in-progress', 'submitted', 'reviewed'];
          var idx = statuses.indexOf(m.status);
          m.status = statuses[(idx + 1) % statuses.length];
          saveData();
          if (m.githubSynced) updateMissionStatusOnGithub(m);
          render();
        }
      };
    });

    // Filter
    document.querySelectorAll('.filter-chip').forEach(function(el) {
      el.onclick = function() { state.filter = el.getAttribute('data-filter'); render(); };
    });

    // Search
    var ms = document.getElementById('mission-search');
    if (ms) { ms.oninput = function() { state.search = ms.value; rerenderPage(); }; }
    var ws = document.getElementById('wiki-search');
    if (ws) {
      ws.oninput = function() {
        var q = ws.value.toLowerCase();
        var filtered = state.wiki.filter(function(w) {
          return w.title.toLowerCase().indexOf(q) >= 0 || (w.content && w.content.toLowerCase().indexOf(q) >= 0);
        });
        var list = document.getElementById('wiki-list');
        if (list) list.innerHTML = wikiList(filtered);
      };
    }

    // Submit
    var sb = document.getElementById('submit-btn');
    if (sb) {
      sb.onclick = function() {
        var mid = document.getElementById('submit-mission').value;
        if (!mid) { alert('미션을 선택하세요'); return; }
        var prLink = document.getElementById('submit-pr').value;
        var m = state.missions.find(function(x) { return x.id === mid; });
        if (m) {
          m.status = 'submitted';
          if (prLink) {
            var prMatch = prLink.match(/\/pull\/(\d+)/);
            if (prMatch) m.pr = parseInt(prMatch[1]);
          }
          saveData();
          if (m.githubSynced) updateMissionStatusOnGithub(m);
          alert('제출 완료!');
          navigate('missions');
        }
      };
    }

    // GitHub sync
    var gsb = document.getElementById('github-sync-btn');
    if (gsb) { gsb.onclick = function() { fetchGithubIssues(); }; }

    // GitHub create issue for single mission
    document.querySelectorAll('[data-create-issue]').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-create-issue');
        var m = state.missions.find(function(x) { return x.id === id; });
        if (m) createGithubIssue(m);
      };
    });

    // GitHub create all
    var gab = document.getElementById('github-create-all-btn');
    if (gab) {
      gab.onclick = function() {
        var unsynced = state.missions.filter(function(m) { return !m.issue; });
        if (!unsynced.length) return;
        if (!confirm(unsynced.length + '개 미션의 GitHub 이슈를 생성합니다.')) return;
        unsynced.forEach(function(m, i) {
          setTimeout(function() { createGithubIssue(m); }, i * 1500);
        });
      };
    }

    // Settings
    var sv = document.getElementById('settings-save');
    if (sv) {
      sv.onclick = function() {
        state.settings.githubRepo = document.getElementById('set-repo').value;
        state.settings.githubToken = document.getElementById('set-token').value;
        state.settings.vaultPath = document.getElementById('set-vault').value;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch(e) {}
        alert('저장되었습니다');
      };
    }

    // Data export
    var de = document.getElementById('data-export');
    if (de) {
      de.onclick = function() {
        var blob = new Blob([JSON.stringify({ missions: state.missions, wiki: state.wiki }, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ab-tasks.json';
        a.click();
      };
    }

    // Data reset
    var dr = document.getElementById('data-reset');
    if (dr) {
      dr.onclick = function() {
        if (confirm('모든 데이터를 초기화합니다')) {
          localStorage.removeItem(STORAGE_KEY);
          state.missions = [];
          state.wiki = [];
          init();
        }
      };
    }
  }

  function rerenderPage() {
    var main = document.querySelector('.dashboard-main');
    if (main && state.page === 'missions') { main.innerHTML = pageMissions(); bindEvents(); }
  }

  /* ====== Utils ====== */
  function esc(s) {
    if (s === null || s === undefined) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  /* ====== Boot ====== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

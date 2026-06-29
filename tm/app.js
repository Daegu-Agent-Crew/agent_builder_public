/* ============================================================
   team-memory Console — Vanilla JS SPA
   GitHub Pages + Discord 에이전트 연동
   ============================================================ */

(function () {
  'use strict';

  /* ====== Config ====== */
  var TM_REPO = 'Daegu-Agent-Crew/team-memory';
  var TM_API = 'https://api.github.com/repos/' + TM_REPO;
  var TM_RAW = 'https://raw.githubusercontent.com/' + TM_REPO + '/main';

  var STORAGE_KEY = 'tm_console_settings';

  /* ====== State ====== */
  var settings = loadSettings();
  var state = {
    projects: [],
    members: [],
    records: [],
    wikis: {},
    currentProject: null,
    pipelineActive: false,
    pipelineStep: 0,
    pipelineResults: [],
    lastCommitSha: null,
  };

  /* ====== Settings ====== */
  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { token: '', discordWebhook: '', member: '' };
  }
  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function ghHeaders(extra) {
    var h = { 'Accept': 'application/vnd.github.v3+json' };
    if (settings.token) h['Authorization'] = 'token ' + settings.token;
    if (extra) Object.assign(h, extra);
    return h;
  }

  /* ====== Utils ====== */
  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function fmtDate(d) { return d ? d.slice(0, 10) : ''; }
  function slugify(s) {
    return (s || '').toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  function mdToHtml(md) {
    if (!md) return '';
    var html = esc(md);
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function (m) { return '<ul>' + m + '</ul>'; });
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    return html;
  }

  /* ====== GitHub API ====== */

  function ghListDir(path, cb) {
    fetch(TM_API + '/contents/' + path, { headers: ghHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(Array.isArray(data) ? data : null); })
      .catch(function () { cb(null); });
  }

  function ghGetFile(path, cb) {
    fetch(TM_RAW + '/' + path)
      .then(function (r) { return r.text(); })
      .then(function (text) { cb(text); })
      .catch(function () { cb(null); });
  }

  function ghCreateFile(path, content, message, cb) {
    fetch(TM_API + '/contents/' + path, {
      method: 'PUT',
      headers: ghHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        message: message || 'tm-console: create ' + path,
        content: btoa(unescape(encodeURIComponent(content)))
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(data); })
      .catch(function (e) { console.error('ghCreateFile:', e); cb(null); });
  }

  function ghGetCommits(path, cb) {
    var url = TM_API + '/commits?per_page=5';
    if (path) url += '&path=' + encodeURIComponent(path);
    fetch(url, { headers: ghHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(Array.isArray(data) ? data : null); })
      .catch(function () { cb(null); });
  }

  /* ====== Data Loading ====== */

  function loadAll(cb) {
    var tasks = 4;
    function done() { if (--tasks === 0) cb(); }

    // 1. Projects
    ghListDir('context/registry/projects', function (files) {
      if (!files) { state.projects = []; done(); return; }
      var rem = files.filter(function (f) { return f.name.endsWith('.yml'); }).length;
      if (rem === 0) { done(); return; }
      state.projects = [];
      files.forEach(function (f) {
        if (!f.name.endsWith('.yml')) return;
        ghGetFile(f.path, function (text) {
          if (text) {
            var pid = f.name.replace('.yml', '');
            var proj = parseYml(text);
            proj.id = pid;
            state.projects.push(proj);
          }
          if (--rem === 0) {
            state.projects.sort(function (a, b) {
              return (a.name || a.id).localeCompare(b.name || b.id);
            });
            done();
          }
        });
      });
    });

    // 2. Members
    ghGetFile('.github/team-memory-members.yml', function (text) {
      if (text) {
        state.members = text.trim().split('\n').filter(function (l) {
          return l.startsWith('- ');
        }).map(function (l) { return l.slice(2).trim(); });
      }
      done();
    });

    // 3. Records
    loadRecords(done);

    // 4. Wikis (deferred, load after projects)
    setTimeout(function () {
      if (state.projects.length === 0) { done(); return; }
      var rem = state.projects.length;
      state.wikis = {};
      state.projects.forEach(function (p) {
        ghGetFile('context/wiki/projects/' + p.id + '/current-context.md', function (text) {
          if (text) state.wikis[p.id] = text;
          if (--rem === 0) done();
        });
      });
    }, 500);
  }

  function loadRecords(cb) {
    state.records = [];

    // Root records
    ghListDir('context/records', function (files) {
      if (files) {
        var mdFiles = files.filter(function (f) {
          return f.name.endsWith('.md') && f.type === 'file';
        });
        mdFiles.forEach(function (f) {
          ghGetFile(f.path, function (text) {
            if (text) {
              var rec = parseRecord(text, f.path, null);
              state.records.push(rec);
            }
          });
        });
      }
    });

    // Per-project records
    ghListDir('context/records/projects', function (dirs) {
      if (!dirs) { cb(); return; }
      var projDirs = dirs.filter(function (d) { return d.type === 'dir'; });
      var rem = projDirs.length;
      if (rem === 0) { cb(); return; }

      projDirs.forEach(function (d) {
        var pid = d.name;
        ghListDir(d.path, function (files) {
          if (files) {
            var mdFiles = files.filter(function (f) {
              return f.name.endsWith('.md') && f.type === 'file';
            });
            mdFiles.forEach(function (f) {
              ghGetFile(f.path, function (text) {
                if (text) {
                  var rec = parseRecord(text, f.path, pid);
                  state.records.push(rec);
                }
              });
            });
          }
          if (--rem === 0) {
            // Give async gets a moment
            setTimeout(function () {
              state.records.sort(function (a, b) {
                return (b.date || '').localeCompare(a.date || '');
              });
              cb();
            }, 800);
          }
        });
      });
    });
  }

  /* ====== Parsers ====== */

  function parseYml(text) {
    var obj = {};
    text.split('\n').forEach(function (line) {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      var idx = line.indexOf(':');
      if (idx < 0) return;
      var key = line.slice(0, idx).trim();
      var val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      obj[key] = val;
    });
    return obj;
  }

  function parseRecord(text, path, project) {
    var fm = {};
    var body = text;
    var fmMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      fmMatch[1].split('\n').forEach(function (line) {
        line = line.trim();
        var idx = line.indexOf(':');
        if (idx < 0) return;
        fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      body = fmMatch[2];
    }

    var titleMatch = body.match(/^#\s+(.+)$/m);
    var title = fm.title || (titleMatch ? titleMatch[1].trim() : path.split('/').pop().replace('.md', ''));
    var dateMatch = path.match(/(\d{4}-\d{2}-\d{2})/);

    return {
      title: title,
      date: fm.date || (dateMatch ? dateMatch[1] : ''),
      member: fm.member || '',
      source_type: fm.source_type || '',
      project: project || fm.project || '',
      visibility: fm.visibility || '',
      body: body.trim(),
      path: path
    };
  }

  /* ====== Discord Webhook Trigger ====== */

  function triggerPipeline(projectId, recordPath, cb) {
    if (!settings.discordWebhook) {
      if (cb) cb({ error: 'Discord webhook URL이 설정되지 않았습니다.' });
      return;
    }

    var jobId = 'tm-' + Date.now();
    var msg =
      '[tm-pipeline] jobId=' + jobId + '\n' +
      'project=' + projectId + '\n' +
      'record=' + recordPath + '\n' +
      'steps=wiki,verify,sync,dashboard,share\n' +
      'source=tm-console-web\n' +
      'member=' + (settings.member || 'anonymous');

    // Save initial commit sha for polling
    ghGetCommits(null, function (commits) {
      state.lastCommitSha = (commits && commits[0]) ? commits[0].sha : null;

      fetch(settings.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (cb) cb({ jobId: jobId, webhook: data });
          // Start polling
          pollPipeline(jobId);
        })
        .catch(function (e) {
          if (cb) cb({ error: 'Webhook 전송 실패: ' + e.message });
        });
    });
  }

  function pollPipeline(jobId) {
    state.pipelineActive = true;
    state.pipelineStep = 0;
    state.pipelineResults = [];
    var pollCount = 0;
    var maxPolls = 60; // 5 minutes max

    var interval = setInterval(function () {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(interval);
        state.pipelineActive = false;
        if (window.location.hash === '#/pipeline') route();
        return;
      }

      // Check for new commits
      ghGetCommits(null, function (commits) {
        if (!commits || !commits[0]) return;
        if (state.lastCommitSha && commits[0].sha === state.lastCommitSha) return; // no change

        // New commit detected
        var newCommits = [];
        for (var i = 0; i < commits.length; i++) {
          if (commits[i].sha === state.lastCommitSha) break;
          newCommits.push(commits[i]);
        }
        state.lastCommitSha = commits[0].sha;

        // Map commits to pipeline steps
        newCommits.forEach(function (c) {
          var msg = (c.commit.message || '').toLowerCase();
          if (msg.indexOf('wiki') >= 0) state.pipelineStep = Math.max(state.pipelineStep, 1);
          if (msg.indexOf('verify') >= 0 || msg.indexOf('memory-verify') >= 0) state.pipelineStep = Math.max(state.pipelineStep, 2);
          if (msg.indexOf('sync') >= 0 || msg.indexOf('memory-sync') >= 0) state.pipelineStep = Math.max(state.pipelineStep, 3);
          if (msg.indexOf('dashboard') >= 0) state.pipelineStep = Math.max(state.pipelineStep, 4);
          if (msg.indexOf('share') >= 0) state.pipelineStep = Math.max(state.pipelineStep, 5);
          state.pipelineResults.push({
            sha: c.sha.slice(0, 7),
            message: c.commit.message,
            author: c.commit.author ? c.commit.author.login : '',
            url: c.html_url
          });
        });

        if (state.pipelineStep >= 5) {
          state.pipelineActive = false;
          clearInterval(interval);
        }

        if (window.location.hash === '#/pipeline') route();
      });
    }, 5000); // poll every 5s
  }

  /* ====== Router ====== */

  function getHash() {
    var h = location.hash;
    if (!h || h === '#' || h === '#/') return '';
    return h.replace(/^#\/?/, '');
  }

  function navigate(hash) {
    location.hash = '#/' + hash;
  }

  function route() {
    var fragment = getHash();
    var main = document.getElementById('app-main');

    // Update nav
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.remove('active');
      var href = a.getAttribute('href');
      if (href === '#' + location.hash || (href === '#' && !fragment)) {
        a.classList.add('active');
      }
    });

    if (!fragment || fragment === 'home') {
      renderHome(main);
    } else if (fragment === 'records') {
      renderRecords(main);
    } else if (fragment === 'new') {
      renderNewRecord(main);
    } else if (fragment === 'wiki') {
      renderWiki(main);
    } else if (fragment === 'pipeline') {
      renderPipeline(main);
    } else if (fragment === 'settings') {
      renderSettings(main);
    } else if (fragment.indexOf('record/') === 0) {
      var path = decodeURIComponent(fragment.replace('record/', ''));
      renderRecordDetail(main, path);
    } else {
      renderHome(main);
    }
  }

  /* ====== Render: Home ====== */

  function renderHome(main) {
    var projectCount = state.projects.length;
    var recordCount = state.records.length;
    var wikiCount = Object.keys(state.wikis).length;
    var memberCount = state.members.length;

    var recentRecords = state.records.slice(0, 5);

    var html = '<div class="page-title">🧠 team-memory 콘솔</div>';
    html += '<p class="page-desc">레코드 관리 및 에이전트 파이프라인 실행</p>';

    // Stats
    html += '<div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;">';
    html += statCard('📁', projectCount, '프로젝트');
    html += statCard('📄', recordCount, '레코드');
    html += statCard('📖', wikiCount, '위키');
    html += statCard('👥', memberCount, '멤버');
    html += '</div>';

    // Token warning
    if (!settings.token) {
      html += '<div class="alert alert-warning">⚠️ GitHub 토큰이 설정되지 않았습니다. <a href="#/settings">설정</a>에서 PAT를 입력하세요.</div>';
    }
    if (!settings.discordWebhook) {
      html += '<div class="alert alert-warning">⚠️ Discord webhook이 설정되지 않았습니다. 에이전트 트리거를 사용할 수 없습니다. <a href="#/settings">설정</a></div>';
    }

    // Recent records
    html += '<div class="section">';
    html += '<div class="section-title">🕒 최근 레코드</div>';
    if (recentRecords.length === 0) {
      html += '<div class="empty-state">레코드가 없습니다.</div>';
    } else {
      html += '<div class="record-list">';
      recentRecords.forEach(function (r) {
        html += recordItemHTML(r);
      });
      html += '</div>';
    }
    html += '</div>';

    // Quick actions
    html += '<div class="section">';
    html += '<div class="section-title">⚡ 빠른 작업</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    html += '<a href="#/new" class="btn btn-primary">✨ 새 레코드 작성</a>';
    html += '<a href="#/pipeline" class="btn">🔧 파이프라인 실행</a>';
    html += '<a href="#/wiki" class="btn">📖 위키 보기</a>';
    html += '<a href="../dashboard/" class="btn">📊 대시보드</a>';
    html += '</div>';
    html += '</div>';

    main.innerHTML = html;
  }

  function statCard(icon, value, label) {
    return '<div class="card" style="text-align:center;padding:16px;">' +
      '<div style="font-size:1.5rem;">' + icon + '</div>' +
      '<div style="font-size:1.4rem;font-weight:700;margin:4px 0;">' + value + '</div>' +
      '<div style="font-size:0.8rem;color:var(--text-muted);">' + label + '</div>' +
    '</div>';
  }

  function recordItemHTML(r) {
    var projBadge = r.project ? '<span style="color:var(--text-muted);">' + esc(r.project) + '</span>' : '';
    var visBadge = r.visibility === 'public'
      ? '<span class="record-badge badge-public">공개</span>'
      : (r.visibility === 'private' ? '<span class="record-badge badge-private">비공개</span>' : '');
    return '<a href="#/record/' + encodeURIComponent(r.path) + '" style="text-decoration:none;color:inherit;">' +
      '<div class="record-item">' +
        '<div class="record-date">' + esc(fmtDate(r.date)) + '</div>' +
        '<div class="record-content">' +
          '<div class="record-title">' + esc(r.title) + visBadge + '</div>' +
          '<div class="record-meta">' + projBadge + (r.member ? ' · 👤 ' + esc(r.member) : '') + (r.source_type ? ' · ' + esc(r.source_type) : '') + '</div>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /* ====== Render: Records ====== */

  function renderRecords(main) {
    var html = '<div class="page-title">📄 레코드</div>';
    html += '<p class="page-desc">전체 레코드 조회</p>';

    // Project filter
    html += '<div class="project-selector">';
    html += '<span class="project-chip active" data-pid="">전체</span>';
    state.projects.forEach(function (p) {
      html += '<span class="project-chip" data-pid="' + esc(p.id) + '">' + esc(p.name || p.id) + '</span>';
    });
    html += '</div>';

    var filtered = state.records;
    html += '<div id="record-list-container">';
    html += '<div class="record-list">';
    if (filtered.length === 0) {
      html += '<div class="empty-state">레코드가 없습니다.</div>';
    } else {
      filtered.forEach(function (r) {
        html += recordItemHTML(r);
      });
    }
    html += '</div>';
    html += '</div>';

    main.innerHTML = html;

    // Filter handler
    var listContainer = main.querySelector('#record-list-container');
    main.querySelectorAll('.project-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        main.querySelectorAll('.project-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var pid = chip.dataset.pid;
        var recs = pid ? state.records.filter(function (r) { return r.project === pid; })
                       : state.records;

        var listHTML = '<div class="record-list">';
        if (recs.length === 0) {
          listHTML += '<div class="empty-state">이 프로젝트에 레코드가 없습니다.</div>';
        } else {
          recs.forEach(function (r) { listHTML += recordItemHTML(r); });
        }
        listHTML += '</div>';
        listContainer.innerHTML = listHTML;
      });
    });
  }

  /* ====== Render: Record Detail ====== */

  function renderRecordDetail(main, path) {
    var rec = state.records.filter(function (r) { return r.path === path; })[0];
    if (!rec) {
      main.innerHTML = '<div class="alert alert-error">레코드를 찾을 수 없습니다: ' + esc(path) + '</div>';
      return;
    }

    var html = '<a href="#/records" class="btn btn-sm" style="margin-bottom:16px;">← 목록으로</a>';
    html += '<div class="card">';
    html += '<h2 style="margin-bottom:8px;">' + esc(rec.title) + '</h2>';
    html += '<div class="record-meta" style="margin-bottom:16px;">';
    html += '📅 ' + esc(fmtDate(rec.date));
    if (rec.member) html += ' · 👤 ' + esc(rec.member);
    if (rec.source_type) html += ' · 📝 ' + esc(rec.source_type);
    if (rec.project) html += ' · 📁 ' + esc(rec.project);
    html += '</div>';
    html += '<div class="wiki-content">' + mdToHtml(rec.body) + '</div>';
    html += '</div>';

    // Pipeline trigger for this record's project
    if (rec.project) {
      html += '<div class="card" style="margin-top:16px;">';
      html += '<div class="section-title">🔧 에이전트 파이프라인</div>';
      html += '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">이 레코드의 프로젝트(' + esc(rec.project) + ')에 대해 wiki → verify → sync → dashboard → share 실행</p>';
      html += '<button class="btn btn-primary" id="trigger-pipeline-btn">🚀 파이프라인 실행</button>';
      html += '</div>';
    }

    main.innerHTML = html;

    var btn = document.getElementById('trigger-pipeline-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.textContent = '전송 중...';
        triggerPipeline(rec.project, rec.path, function (result) {
          if (result.error) {
            btn.textContent = '❌ 실패';
            btn.disabled = false;
            alert(result.error);
          } else {
            btn.textContent = '✅ 트리거됨';
            setTimeout(function () { navigate('pipeline'); }, 1000);
          }
        });
      });
    }
  }

  /* ====== Render: New Record ====== */

  function renderNewRecord(main) {
    if (!settings.token) {
      main.innerHTML = '<div class="alert alert-warning">⚠️ GitHub 토큰이 필요합니다. <a href="#/settings">설정</a>에서 PAT를 입력하세요.</div>';
      return;
    }

    var today = new Date().toISOString().slice(0, 10);

    var html = '<div class="page-title">✨ 새 레코드 작성</div>';
    html += '<p class="page-desc">team-memory에 새 레코드를 추가합니다. 저장 후 에이전트 파이프라인을 실행할 수 있습니다.</p>';

    html += '<div class="card">';
    html += '<div class="form-group">';
    html += '<label class="form-label">프로젝트</label>';
    html += '<select class="form-select" id="new-project">';
    state.projects.forEach(function (p) {
      html += '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-row">';
    html += '<div class="form-group"><label class="form-label">작성자 (GitHub)</label>';
    html += '<input class="form-input" id="new-member" value="' + esc(settings.member) + '" placeholder="github-username"></div>';
    html += '<div class="form-group"><label class="form-label">소스 타입</label>';
    html += '<select class="form-select" id="new-source-type">';
    ['markdown', 'codex-session', 'research-note', 'meeting-note', 'external-doc'].forEach(function (t) {
      html += '<option value="' + t + '">' + t + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<div class="form-group"><label class="form-label">제목</label>';
    html += '<input class="form-input" id="new-title" placeholder="레코드 제목"></div>';

    html += '<div class="form-group"><label class="form-label">내용 (Markdown)</label>';
    html += '<textarea class="form-textarea" id="new-body" placeholder="# 제목&#10;&#10;내용을 작성하세요..."></textarea></div>';

    html += '<div class="toggle-row">';
    html += '<input type="checkbox" id="new-visibility"><label class="toggle-label">공개 (visibility: public) — 대시보드에 표시</label>';
    html += '</div>';

    html += '<div class="toggle-row">';
    html += '<input type="checkbox" id="new-run-pipeline" checked><label class="toggle-label">저장 후 에이전트 파이프라인 자동 실행 (wiki → verify → sync → dashboard → share)</label>';
    html += '</div>';

    html += '<div id="new-alert"></div>';
    html += '<button class="btn btn-primary" id="new-submit" style="width:100%;">💾 저장</button>';

    html += '</div>';

    main.innerHTML = html;

    document.getElementById('new-submit').addEventListener('click', function () {
      submitNewRecord();
    });
  }

  function submitNewRecord() {
    var projectId = document.getElementById('new-project').value;
    var member = document.getElementById('new-member').value.trim();
    var sourceType = document.getElementById('new-source-type').value;
    var title = document.getElementById('new-title').value.trim();
    var body = document.getElementById('new-body').value.trim();
    var isPublic = document.getElementById('new-visibility').checked;
    var runPipeline = document.getElementById('new-run-pipeline').checked;
    var alertEl = document.getElementById('new-alert');
    var btn = document.getElementById('new-submit');

    if (!title || !body) {
      alertEl.innerHTML = '<div class="alert alert-error">제목과 내용을 입력하세요.</div>';
      return;
    }
    if (!member) {
      alertEl.innerHTML = '<div class="alert alert-error">작성자를 입력하세요.</div>';
      return;
    }

    var today = new Date().toISOString().slice(0, 10);
    var slug = slugify(title);
    var filename = today + '-' + slug + '.md';
    var filePath = 'context/records/projects/' + projectId + '/' + filename;

    // Build frontmatter
    var content = '---\n';
    content += 'title: "' + title.replace(/"/g, '\\"') + '"\n';
    content += 'date: ' + today + '\n';
    content += 'member: ' + member + '\n';
    content += 'source_type: ' + sourceType + '\n';
    if (isPublic) content += 'visibility: public\n';
    content += '---\n\n';
    content += body;

    btn.disabled = true;
    btn.textContent = '저장 중...';
    alertEl.innerHTML = '<div class="alert alert-info">GitHub에 커밋 중...</div>';

    ghCreateFile(filePath, content, 'docs: ' + title, function (result) {
      if (result && result.commit) {
        alertEl.innerHTML = '<div class="alert alert-success">✅ 저장 완료! <a href="' + result.commit.html_url + '" target="_blank">커밋 보기</a></div>';

        // Reload records
        loadRecords(function () {
          if (runPipeline) {
            btn.textContent = '파이프라인 트리거 중...';
            triggerPipeline(projectId, filePath, function (triggerResult) {
              if (triggerResult.error) {
                alertEl.innerHTML += '<div class="alert alert-error">파이프라인 트리거 실패: ' + esc(triggerResult.error) + '</div>';
                btn.disabled = false;
                btn.textContent = '💾 저장';
              } else {
                navigate('pipeline');
              }
            });
          } else {
            btn.disabled = false;
            btn.textContent = '💾 저장';
            setTimeout(function () { navigate('records'); }, 1500);
          }
        });
      } else {
        var errMsg = (result && result.message) ? result.message : '알 수 없는 오류';
        alertEl.innerHTML = '<div class="alert alert-error">❌ 저장 실패: ' + esc(errMsg) + '</div>';
        btn.disabled = false;
        btn.textContent = '💾 저장';
      }
    });
  }

  /* ====== Render: Wiki ====== */

  function renderWiki(main) {
    var html = '<div class="page-title">📖 위키 요약</div>';
    html += '<p class="page-desc">프로젝트별 현재 컨텍스트 요약</p>';

    // Project chips
    html += '<div class="project-selector">';
    var wikiProjects = state.projects.filter(function (p) { return state.wikis[p.id]; });
    if (wikiProjects.length === 0) {
      html += '</div>';
      html += '<div class="empty-state">위키가 없습니다. 파이프라인을 실행해서 위키를 생성하세요.</div>';
      main.innerHTML = html;
      return;
    }

    var defaultPid = wikiProjects[0].id;
    wikiProjects.forEach(function (p, i) {
      html += '<span class="project-chip' + (i === 0 ? ' active' : '') + '" data-pid="' + esc(p.id) + '">' + esc(p.name || p.id) + '</span>';
    });
    html += '</div>';

    html += '<div id="wiki-display"></div>';
    main.innerHTML = html;

    var display = document.getElementById('wiki-display');

    function showWiki(pid) {
      var content = state.wikis[pid];
      if (!content) {
        display.innerHTML = '<div class="empty-state">위키가 없습니다.</div>';
        return;
      }
      display.innerHTML = '<div class="card"><div class="wiki-content">' + mdToHtml(content) + '</div></div>';
    }

    showWiki(defaultPid);

    main.querySelectorAll('.project-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        main.querySelectorAll('.project-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        showWiki(chip.dataset.pid);
      });
    });
  }

  /* ====== Render: Pipeline ====== */

  var PIPELINE_STEPS = [
    { key: 'wiki', name: '위키 재생성', icon: '📖', skill: 'tm-wiki' },
    { key: 'verify', name: '검증', icon: '✅', skill: 'tm-verify + tm-sync' },
    { key: 'sync', name: 'Git 동기화', icon: '🔄', skill: 'tm-sync' },
    { key: 'dashboard', name: '대시보드 갱신', icon: '📊', skill: 'tm-dashboard' },
    { key: 'share', name: '공유문 초안', icon: '💬', skill: 'tm-share' }
  ];

  function renderPipeline(main) {
    var html = '<div class="page-title">🔧 에이전트 파이프라인</div>';
    html += '<p class="page-desc">tm-wiki → tm-verify → tm-sync → tm-dashboard → tm-share 순차 실행</p>';

    // Pipeline status
    html += '<div class="pipeline-container">';
    PIPELINE_STEPS.forEach(function (step, i) {
      var cls = '';
      var statusText = '대기';
      if (state.pipelineActive) {
        if (i < state.pipelineStep) { cls = 'done'; statusText = '완료'; }
        else if (i === state.pipelineStep) { cls = 'active'; statusText = '실행 중...'; }
      } else if (state.pipelineStep >= PIPELINE_STEPS.length && i < PIPELINE_STEPS.length) {
        cls = 'done';
        statusText = '완료';
      }
      html += '<div class="pipeline-step ' + cls + '">';
      html += '<div class="pipeline-icon">' + step.icon + '</div>';
      html += '<div class="pipeline-name">' + esc(step.name) + '</div>';
      html += '<div class="pipeline-status">' + statusText + '</div>';
      html += '</div>';
      if (i < PIPELINE_STEPS.length - 1) {
        html += '<div class="pipeline-arrow">→</div>';
      }
    });
    html += '</div>';

    // Progress bar
    var progress = state.pipelineStep > 0 ? (state.pipelineStep / PIPELINE_STEPS.length) * 100 : 0;
    if (!state.pipelineActive && state.pipelineStep >= PIPELINE_STEPS.length) progress = 100;
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%;"></div></div>';

    // Manual trigger
    if (!state.pipelineActive) {
      html += '<div class="card">';
      html += '<div class="section-title">🚀 수동 실행</div>';
      html += '<div class="form-group">';
      html += '<label class="form-label">프로젝트</label>';
      html += '<select class="form-select" id="pipeline-project">';
      state.projects.forEach(function (p) {
        html += '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) + '</option>';
      });
      html += '</select>';
      html += '</div>';
      html += '<button class="btn btn-primary" id="pipeline-trigger-btn" style="width:100%;">🚀 파이프라인 실행</button>';
      html += '</div>';
    } else {
      html += '<div class="alert alert-warning">⏳ 파이프라인 실행 중... 5초마다 자동 새로고침</div>';
    }

    // Recent commits
    if (state.pipelineResults.length > 0) {
      html += '<div class="section">';
      html += '<div class="section-title">📋 처리 내역</div>';
      state.pipelineResults.forEach(function (c) {
        html += '<div class="record-item">';
        html += '<div class="record-content">';
        html += '<div class="record-title"><code>' + esc(c.sha) + '</code> ' + esc(c.message) + '</div>';
        html += '<div class="record-meta">👤 ' + esc(c.author) + '</div>';
        html += '</div>';
        html += '<a href="' + c.url + '" target="_blank" class="btn btn-sm">↗</a>';
        html += '</div>';
      });
      html += '</div>';
    }

    main.innerHTML = html;

    var btn = document.getElementById('pipeline-trigger-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var pid = document.getElementById('pipeline-project').value;
        btn.disabled = true;
        btn.textContent = '전송 중...';
        triggerPipeline(pid, '', function (result) {
          if (result.error) {
            btn.textContent = '❌ 실패';
            btn.disabled = false;
            alert(result.error);
          } else {
            route();
          }
        });
      });
    }
  }

  /* ====== Render: Settings ====== */

  function renderSettings(main) {
    var html = '<div class="page-title">⚙️ 설정</div>';
    html += '<p class="page-desc">GitHub PAT 및 Discord webhook 설정</p>';

    html += '<div class="card settings-card">';

    // Token
    html += '<div class="section-title">🔐 GitHub 토큰</div>';
    html += '<div class="token-status ' + (settings.token ? 'token-ok' : 'token-missing') + '">';
    html += settings.token ? '✅ 토큰 설정됨' : '❌ 토큰 없음';
    html += '</div>';
    html += '<div class="form-group" style="margin-top:12px;">';
    html += '<label class="form-label">Personal Access Token (PAT)</label>';
    html += '<input class="form-input" id="set-token" type="password" placeholder="github_pat_..." value="' + esc(settings.token) + '">';
    html += '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">team-memory 리포 읽기/쓰기 권한이 필요합니다. 로컬 브라우저에만 저장됩니다.</p>';
    html += '</div>';

    // Webhook
    html += '<div class="section-title">💬 Discord Webhook</div>';
    html += '<div class="form-group">';
    html += '<label class="form-label">Webhook URL</label>';
    html += '<input class="form-input" id="set-webhook" type="url" placeholder="https://discord.com/api/webhooks/..." value="' + esc(settings.discordWebhook) + '">';
    html += '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">에이전트 트리거용 읽기전용 webhook. 대구루가 감시하는 채널의 webhook URL을 입력하세요.</p>';
    html += '</div>';

    // Member
    html += '<div class="section-title">👤 기본 작성자</div>';
    html += '<div class="form-group">';
    html += '<input class="form-input" id="set-member" placeholder="GitHub username" value="' + esc(settings.member) + '">';
    html += '</div>';

    html += '<button class="btn btn-primary" id="set-save" style="width:100%;">💾 저장</button>';
    html += '<div id="set-alert" style="margin-top:12px;"></div>';

    html += '</div>';

    main.innerHTML = html;

    document.getElementById('set-save').addEventListener('click', function () {
      settings.token = document.getElementById('set-token').value.trim();
      settings.discordWebhook = document.getElementById('set-webhook').value.trim();
      settings.member = document.getElementById('set-member').value.trim();
      saveSettings();
      document.getElementById('set-alert').innerHTML = '<div class="alert alert-success">✅ 저장되었습니다.</div>';
      setTimeout(function () { route(); }, 1000);
    });
  }

  /* ====== Init ====== */

  function init() {
    if (!settings.token) {
      // No token — show settings prompt
      var main = document.getElementById('app-main');
      main.innerHTML = '<div class="card" style="max-width:500px;margin:40px auto;">' +
        '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="font-size:3rem;">🧠</div>' +
        '<h2 style="margin:12px 0;">team-memory 콘솔</h2>' +
        '<p style="color:var(--text-muted);">시작하려면 GitHub PAT가 필요합니다.</p>' +
        '</div>' +
        '<a href="#/settings" class="btn btn-primary" style="width:100%;">⚙️ 설정으로 이동</a>' +
        '<a href="#/records" class="btn" style="width:100%;margin-top:8px;">읽기 전용으로 둘러보기</a>' +
        '</div>';
      // Still try to load public data
      loadAll(function () {});
      return;
    }

    loadAll(function () {
      route();
    });
  }

  // Boot
  window.addEventListener('hashchange', route);
  init();
})();

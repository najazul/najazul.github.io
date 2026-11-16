/* norman.dev — a portfolio you read like a terminal session.
 * Content lives in /content/*.md. Every file you open is added to the
 * "context window"; reading everything fills it to 100%. */
(() => {
  'use strict';

  const GH_USER = 'najazul';
  const STORE_KEY = 'nj-portfolio-read-v1';
  const THEME_KEY = 'nj-portfolio-theme';

  // ---------- documents (the "files") ----------
  const DOCS = [
    { id: 'about',                path: 'about.md',                cmd: '/about',                desc: 'Who I am and what I focus on' },
    { id: 'experience',           path: 'experience.md',           cmd: '/experience',           desc: 'Work experience and awards' },
    { id: 'projects',             path: 'projects.md',             cmd: '/projects',             desc: 'Projects pulled from GitHub' },
    { id: 'blog',                 path: 'blog/README.md',          cmd: '/blog',                 desc: 'How I built my highlighted projects' },
    { id: 'blog/expense-tracker', path: 'blog/expense-tracker.md', cmd: '/blog expense-tracker', desc: '.NET + React on free-tier cloud' },
    { id: 'blog/drain',           path: 'blog/drain.md',           cmd: '/blog drain',           desc: 'A geocoding worker that doesn\'t fall over' },
    { id: 'blog/skolaroid',       path: 'blog/skolaroid.md',       cmd: '/blog skolaroid',       desc: 'Locking down a campus app' },
    { id: 'skills',               path: 'skills.md',               cmd: '/skills',               desc: 'My stack' },
    { id: 'education',            path: 'education.md',            cmd: '/education',            desc: 'Education and activities' },
    { id: 'contact',              path: 'contact.md',              cmd: '/contact',              desc: 'Socials and live projects' },
    { id: 'github',               path: 'github (live)',           cmd: '/github',               desc: 'Live repo list from the GitHub API', live: true, tokens: 900 },
  ];
  const byId = Object.fromEntries(DOCS.map((d, i) => [d.id, Object.assign(d, { color: 'c' + i })]));

  const SESSION_CMDS = [
    { cmd: '/help',    desc: 'Show all commands' },
    { cmd: '/context', desc: 'See how much of the portfolio you\'ve read' },
    { cmd: '/compact', desc: 'Reset the context window to 0%' },
    { cmd: '/clear',   desc: 'Clear the screen so you don\'t scroll (keeps context)' },
    { cmd: '/theme',   desc: 'Switch light / dark' },
  ];
  const MENU = [...DOCS.map(d => ({ cmd: d.cmd, desc: d.desc })), ...SESSION_CMDS];

  const VERBS = ['Compiling', 'Querying', 'Resolving DNS', 'Containerizing', 'Migrating', 'Hashing', 'Handshaking',
    'Indexing', 'Caching', 'Deploying', 'Validating JWT', 'Provisioning', 'Spinning up', 'Pinging', 'Normalizing'];
  const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- dom ----------
  const $ = (s) => document.querySelector(s);
  const term = $('#term'), log = $('#log'), input = $('#cmd'), form = $('#prompt'), menu = $('#menu');
  const ctxBtn = $('#ctx'), ctxFill = $('#ctx-fill'), ctxText = $('#ctx-text'), statusLeft = $('#status-left');

  // ---------- storage (best effort) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  let readSet = new Set();
  try { readSet = new Set(JSON.parse(store.get(STORE_KEY) || '[]').filter(id => byId[id])); } catch { /* ignore */ }
  const saveRead = () => store.set(STORE_KEY, JSON.stringify([...readSet]));

  const savedTheme = store.get(THEME_KEY);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  const buddy = (id) => document.dispatchEvent(new CustomEvent('buddy', { detail: { type: 'page', id } }));
  const scrollDown = () => { term.scrollTop = term.scrollHeight; };
  // put the top of a new answer at the top of the screen, so long pages read from the start
  const scrollToEntry = (el) => { term.scrollTop = Math.max(0, el.offsetTop - term.offsetTop - 12); };
  function clearScreen() {
    log.innerHTML = '';
    term.scrollTop = 0;
    buddy('clear');
    entry(`<div class="tool">${toolHead('Clear', null, 'info')}${sub(`Screen cleared · context kept at ${pct()}% · <a href="#" data-cmd="/help">/help</a>`)}</div>`);
  }
  const cmdLink = (c, label) => `<a href="#" data-cmd="${esc(c)}">${esc(label || c)}</a>`;
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    const units = [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
    for (const [sec, u] of units) if (s >= sec) return Math.floor(s / sec) + u + ' ago';
    return 'just now';
  }

  // ---------- markdown → "file view" html ----------
  const KW = {
    csharp: 'var|new|await|async|return|public|private|readonly|class|using|namespace|string|int|if|else|null|true|false|foreach|in|is|throw',
    ts: 'const|let|var|function|return|await|async|if|else|for|new|import|from|export|type|null|true|false|of|in',
    sql: 'ALTER|TABLE|ADD|COLUMN|BOOLEAN|INTEGER|NOT|NULL|DEFAULT|DROP|SELECT|FROM|WHERE|INSERT|UPDATE|true|false',
  };
  KW.js = KW.ts; KW.cs = KW.csharp;
  function highlight(code, lang) {
    const kw = KW[lang];
    if (!kw) return esc(code);
    const comment = lang === 'sql' ? '--.*$' : '\\/\\/.*$';
    const re = new RegExp(`(${comment})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`[^\`]*\`)|\\b(${kw})\\b|\\b(\\d+)\\b`, 'gm');
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const cls = m[1] ? 'tok-c' : m[2] ? 'tok-s' : m[3] ? 'tok-k' : 'tok-n';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  function inline(src) {
    const slots = [];
    const hold = (html) => `\u0000${slots.push(html) - 1}\u0000`;
    let s = src.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
    s = s.replace(/\[([^\]]+)\]\((cmd:[^)]+|[^)\s]+)\)/g, (_, text, url) => {
      const label = emph(esc(text));
      if (url.startsWith('cmd:')) return hold(`<a href="#" data-cmd="${esc(url.slice(4))}">${label}</a>`);
      return hold(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    });
    s = emph(esc(s));
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
  }
  function emph(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>');
  }

  function renderMarkdown(md) {
    const lines = md.replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    const isBlockStart = (l) => /^(```|#{1,6}\s|>\s?|\||-{3,}\s*$|\s*([-*]|\d+\.)\s+)/.test(l);
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if (!line.trim()) { i++; continue; }
      if ((m = line.match(/^```(\w*)/))) {
        const lang = m[1]; const body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push(`<pre><span class="fence">\`\`\`${esc(lang)}</span><code>${highlight(body.join('\n'), lang)}</code><span class="fence">\`\`\`</span></pre>`);
        continue;
      }
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        const n = Math.min(m[1].length, 3);
        out.push(`<div class="h h${n}" role="heading" aria-level="${m[1].length}"><span class="mk">${m[1]} </span>${inline(m[2])}</div>`);
        i++; continue;
      }
      if (/^-{3,}\s*$/.test(line)) { out.push('<div class="hr" aria-hidden="true">---</div>'); i++; continue; }
      if (line.startsWith('|')) {
        const rows = [];
        while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
        const cells = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map(c => c.trim());
        const head = cells(rows[0]);
        const body = rows.slice(1).filter(r => !/^\|[\s:|-]+\|?\s*$/.test(r));
        out.push('<div class="tbl"><table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') +
          '</tr></thead><tbody>' + body.map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }
      if (/^>\s?/.test(line)) {
        const q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        out.push(`<div class="quote"><span class="mk">&gt; </span>${inline(q.join(' '))}</div>`);
        continue;
      }
      if ((m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/))) {
        const indent = m[1].length;
        let html = inline(m[3]);
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          html += `<span class="cont">${inline(lines[i].trim())}</span>`; i++;
        }
        const marker = /\d/.test(m[2]) ? m[2] + ' ' : '- ';
        out.push(`<div class="li" style="margin-left:${indent * 0.6}em"><span class="mk">${marker}</span><span>${html}</span></div>`);
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
    return out.join('');
  }

  // ---------- output primitives ----------
  function entry(html) {
    const el = document.createElement('div');
    el.className = 'entry';
    el.innerHTML = html;
    log.appendChild(el);
    scrollDown();
    return el;
  }
  const userLine = (text) => `<div class="user-line">${esc(text)}</div>`;
  const toolHead = (name, arg, cls = '') =>
    `<div class="tool-head"><span class="dot ${cls}">⏺</span><span><span class="tool-name">${esc(name)}</span>${arg != null ? `(<span>${esc(arg)}</span>)` : ''}</span></div>`;
  const sub = (html) => `<div class="tool-sub">${html}</div>`;
  const reply = (html) => `<div class="reply">${html}</div>`;

  async function think(el) {
    const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
    const wrap = document.createElement('div');
    wrap.className = 'spinner tool';
    wrap.innerHTML = `<span class="star">✻</span><span class="verb">${verb}…</span><span class="hint">(esc to interrupt)</span>`;
    el.appendChild(wrap);
    scrollDown();
    const total = reduceMotion ? 120 : 280 + Math.random() * 420;
    const star = wrap.querySelector('.star');
    let t = 0, f = 0;
    while (t < total) { star.textContent = SPIN[f++ % SPIN.length]; await sleep(70); t += 70; }
    wrap.remove();
  }

  // ---------- context window ----------
  const totalTokens = () => DOCS.reduce((a, d) => a + (d.tokens || 0), 0);
  const usedTokens = () => [...readSet].reduce((a, id) => a + (byId[id].tokens || 0), 0);
  const pct = () => { const t = totalTokens(); return t ? Math.min(100, Math.round((usedTokens() / t) * 100)) : 0; };
  function updateStatus() {
    const p = pct();
    ctxFill.style.width = p + '%';
    ctxBtn.classList.toggle('warn', p >= 70 && p < 100);
    ctxBtn.classList.toggle('full', p >= 100);
    ctxText.innerHTML = p >= 100
      ? 'context full<span class="ctx-tok"> · you\'ve seen it all</span>'
      : `context ${p}%<span class="ctx-tok"> · ${fmtK(usedTokens())}/${fmtK(totalTokens())}</span>`;
    ctxBtn.setAttribute('aria-label', `Context window ${p}% full. Show details.`);
  }
  function markRead(id) {
    const before = pct();
    const isNew = !readSet.has(id);
    readSet.add(id);
    saveRead();
    updateStatus();
    return { isNew, crossedFull: before < 100 && pct() >= 100 };
  }
  const fullBanner = () => reply(`<div class="banner full"><b>Context window full (100%).</b> You've read every page of my portfolio — thank you! ` +
    `The next step is yours: ${cmdLink('/contact')}. Want to start over? ${cmdLink('/compact')}.</div>`);

  function contextView() {
    const total = totalTokens();
    const cells = 50;
    let grid = '';
    let filled = 0;
    const used = DOCS.filter(d => readSet.has(d.id));
    used.forEach((d, idx) => {
      let n = Math.round((d.tokens / total) * cells);
      if (idx === used.length - 1 && pct() >= 100) n = cells - filled;
      n = Math.max(1, Math.min(n, cells - filled));
      for (let k = 0; k < n; k++) grid += `<span class="${d.color}" title="${esc(d.path)}">⛁</span>`;
      filled += n;
    });
    for (; filled < cells; filled++) grid += '<span class="cfree">⛶</span>';
    const legend = DOCS.map(d => {
      const r = readSet.has(d.id);
      return `<span class="${r ? d.color : 'cfree'}">${r ? '⛁' : '⛶'}</span>` +
        `<a href="#" data-cmd="${esc(d.cmd)}">${esc(d.path)}</a>` +
        `<span class="dim">${fmtK(d.tokens)} tokens · ${r ? '<span style="color:var(--green)">✓ read</span>' : 'unread'}</span>`;
    }).join('');
    const p = pct();
    const left = DOCS.filter(d => !readSet.has(d.id));
    return toolHead('Context Usage', null, 'info') +
      sub(`${fmtK(usedTokens())}/${fmtK(total)} tokens (${p}%) · claude-portfolio-norman`) +
      `<div class="ctx-grid" aria-hidden="true">${grid}</div>` +
      `<div class="ctx-legend">${legend}</div>` +
      (p >= 100 ? fullBanner()
        : `<div class="section-label">${left.length} file${left.length === 1 ? '' : 's'} left. Next up: ${cmdLink(left[0].cmd)}</div>`);
  }

  // ---------- GitHub (live) ----------
  const FALLBACK_REPOS = [
    { name: 'expense-tracker', language: 'TypeScript', stargazers_count: 0, pushed_at: '2026-05-29T17:31:14Z', description: 'Containerized expense tracker: React SPA + secure .NET 10 Web API.', html_url: 'https://github.com/najazul/expense-tracker' },
    { name: 'nlp-exercises', language: 'Jupyter Notebook', stargazers_count: 0, pushed_at: '2026-11-06T22:36:02Z', description: '', html_url: 'https://github.com/najazul/nlp-exercises' },
    { name: 'cmsc-170-naive-bayes', language: 'Jupyter Notebook', stargazers_count: 0, pushed_at: '2026-05-10T16:09:52Z', description: 'Naive Bayes baseline for classifying sleep stages.', html_url: 'https://github.com/najazul/cmsc-170-naive-bayes' },
    { name: 'SUDOKU_WEB_APP', language: 'TypeScript', stargazers_count: 1, pushed_at: '2024-12-12T00:08:15Z', description: 'Sudoku in the browser.', html_url: 'https://github.com/najazul/SUDOKU_WEB_APP' },
  ];
  let reposPromise = null;
  function getRepos() {
    if (reposPromise) return reposPromise;
    reposPromise = (async () => {
      try {
        const cached = sessionStorage.getItem('nj-repos');
        if (cached) return { repos: JSON.parse(cached), live: true };
      } catch { /* ignore */ }
      try {
        const res = await fetch(`https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=pushed`, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = (await res.json()).filter(r => !r.private && r.name !== GH_USER && r.name !== 'aeristhy');
        try { sessionStorage.setItem('nj-repos', JSON.stringify(data)); } catch { /* ignore */ }
        return { repos: data, live: true };
      } catch {
        return { repos: FALLBACK_REPOS, live: false };
      }
    })();
    return reposPromise;
  }
  getRepos().then(({ repos, live }) => {
    const top = repos.filter(r => !r.fork).slice(0, 3);
    $('#recent').innerHTML = top.map(r =>
      `<a href="${esc(r.html_url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a> <span class="dim">· pushed ${ago(r.pushed_at)}</span>`
    ).join('<br />') + (live ? '' : '<br /><span class="faint">(offline snapshot)</span>');
  });

  // ---------- content loading ----------
  const loaded = Promise.all(DOCS.filter(d => !d.live).map(async d => {
    const res = await fetch('content/' + d.path);
    if (!res.ok) throw new Error(d.path);
    d.md = await res.text();
    d.tokens = Math.ceil(d.md.length / 4);
    d.lines = d.md.split('\n').length;
  }));

  // ---------- commands ----------
  async function openDoc(id, el) {
    const d = byId[id];
    if (d.live) return showGithub(el);
    await think(el);
    const { isNew, crossedFull } = markRead(id);
    el.insertAdjacentHTML('beforeend',
      `<div class="tool">${toolHead('Read', d.path)}` +
      sub(`Read ${d.lines} lines · ${isNew ? '+' + fmtK(d.tokens) + ' tokens' : 'already in context'}`) +
      `<article class="file"><div class="file-head"><span class="path">~/portfolio/${esc(d.path)}</span><span>markdown</span></div>` +
      `<div class="md">${renderMarkdown(d.md)}</div></article></div>`);
    if (crossedFull) el.insertAdjacentHTML('beforeend', `<div class="tool">${fullBanner()}</div>`);
    buddy(crossedFull ? 'full' : id);
    try { history.replaceState(null, '', '#/' + id); } catch { /* ignore */ }
  }

  async function showGithub(el) {
    await think(el);
    const { repos, live } = await getRepos();
    const { isNew, crossedFull } = markRead('github');
    const rows = repos.map(r =>
      `| [${r.name}](${r.html_url})${r.fork ? ' `fork`' : ''} | ${r.language || '—'} | ${r.stargazers_count} | ${ago(r.pushed_at)} | ${(r.description || '').replace(/\|/g, '/')} |`);
    const md = `# github.com/${GH_USER}\n\n| repo | lang | ★ | pushed | about |\n|---|---|---|---|---|\n${rows.join('\n')}\n\n` +
      `Team projects (drAIn, Skolaroid, ThriftNotice, Watchoble) live under my teammates' accounts — see [/projects](cmd:/projects).`;
    el.insertAdjacentHTML('beforeend',
      `<div class="tool">${toolHead('Bash', `gh repo list ${GH_USER} --sort pushed`)}` +
      sub(`${live ? 'Fetched' : 'GitHub API unreachable — showing snapshot of'} ${repos.length} public repos · ${isNew ? '+' + fmtK(byId.github.tokens) + ' tokens' : 'already in context'}`) +
      `<article class="file"><div class="file-head"><span class="path">api.github.com/users/${GH_USER}/repos</span><span>${live ? 'live' : 'cached'}</span></div>` +
      `<div class="md">${renderMarkdown(md)}</div></article></div>`);
    if (crossedFull) el.insertAdjacentHTML('beforeend', `<div class="tool">${fullBanner()}</div>`);
    buddy(crossedFull ? 'full' : 'github');
    try { history.replaceState(null, '', '#/github'); } catch { /* ignore */ }
  }

  function helpView() {
    const row = (c, d) => `${cmdLink(c)}<span class="desc">${esc(d)}</span>`;
    const pages = DOCS.filter(d => !d.id.startsWith('blog/'));
    const posts = DOCS.filter(d => d.id.startsWith('blog/'));
    return toolHead('Help', null, 'info') + sub('Commands — type them, or just click') +
      `<div class="section-label">Pages</div><div class="cmds">${pages.map(d => row(d.cmd, d.desc)).join('')}</div>` +
      `<div class="section-label">Blog posts</div><div class="cmds">${posts.map(d => row(d.cmd, d.desc)).join('')}</div>` +
      `<div class="section-label">Session</div><div class="cmds">${SESSION_CMDS.map(c => row(c.cmd, c.desc)).join('')}</div>` +
      `<div class="section-label">Shell (yes, these work too)</div><div class="cmds">` +
      row('ls', 'List files') + row('cat about.md', 'Read a file') + row('whoami', 'Short intro') + row('pwd', 'Where am I') + `</div>` +
      `<div class="section-label">Shortcuts: <span class="faint">/</span> command menu · <span class="faint">tab</span> complete · <span class="faint">↑ ↓</span> history · <span class="faint">ctrl+l</span> clear · <span class="faint">esc</span> close menu</div>`;
  }

  function lsView(dir) {
    const inBlog = /^(\.\/)?blog\/?$/.test(dir || '');
    const items = DOCS.filter(d => !d.live).filter(d => inBlog ? d.id.startsWith('blog') : true);
    const tree = [];
    const top = items.filter(d => !d.path.includes('/'));
    const blog = items.filter(d => d.path.startsWith('blog/'));
    const line = (prefix, d, name) =>
      `<div><span class="faint">${prefix}</span><a href="#" data-cmd="cat ${esc(d.path)}">${esc(name)}</a> ` +
      `<span class="dim">${fmtK(d.tokens)}</span> ${readSet.has(d.id) ? '<span style="color:var(--green)">✓</span>' : ''}</div>`;
    if (!inBlog) top.forEach(d => tree.push(line('├── ', d, d.path)));
    tree.push(`<div><span class="faint">${inBlog ? '' : '└── '}</span><span style="color:var(--blue)">blog/</span></div>`);
    blog.forEach((d, k) => tree.push(line(`${inBlog ? '' : '    '}${k === blog.length - 1 ? '└── ' : '├── '}`, d, d.path.slice(5))));
    return toolHead('Bash', `ls ${dir || ''}`.trim()) +
      `<div class="reply" style="padding-left:18px"><div style="color:var(--blue)">~/portfolio${inBlog ? '/blog' : ''}</div>${tree.join('')}</div>`;
  }

  function resolvePath(p) {
    const clean = p.replace(/^~\/portfolio\//, '').replace(/^\.\//, '').replace(/^content\//, '');
    const d = DOCS.find(x => !x.live && (x.path === clean || x.path === clean + '.md' || x.path.replace(/\.md$/, '') === clean));
    if (d) return d.id;
    if (/^readme(\.md)?$/i.test(clean)) return 'about';
    if (/^blog\/?$/.test(clean)) return 'blog';
    return null;
  }

  function findBlog(arg) {
    const a = arg.toLowerCase().replace(/\.md$/, '');
    const hit = DOCS.find(d => d.id.startsWith('blog/') && (d.id === 'blog/' + a || d.id.slice(5).startsWith(a)));
    return hit ? hit.id : null;
  }

  async function run(raw) {
    const text = raw.trim();
    if (!text) return;
    if (/^\/?clear$|^cls$|^reset$/.test(text)) { clearScreen(); return; }
    const el = entry(userLine(text));
    const [head, ...rest] = text.split(/\s+/);
    const arg = rest.join(' ');
    const cmd = head.toLowerCase();
    const say = (html, cls = 'info', name = null) => (cls === 'err' && buddy(cmd === 'sudo' || cmd === 'su' || cmd === 'chmod' || cmd === 'chown' ? 'sudo' : 'error'), el.insertAdjacentHTML('beforeend', `<div class="tool">${name ? toolHead(name, null, cls) : ''}${reply(html)}</div>`));

    try { await loaded; } catch {
      say('Could not load the content files. If you opened <code>index.html</code> straight from disk, serve the folder instead: <code>python3 -m http.server</code>', 'err');
      return;
    }

    switch (cmd) {
      case '/help': case 'help': case '?': case 'man':
        await think(el); el.insertAdjacentHTML('beforeend', `<div class="tool">${helpView()}</div>`); buddy('help'); break;
      case '/about': case '/experience': case '/projects': case '/skills': case '/education': case '/contact': case '/github':
        await openDoc(cmd.slice(1), el); break;
      case '/blog': {
        if (!arg) { await openDoc('blog', el); break; }
        const id = findBlog(arg);
        if (id) await openDoc(id, el);
        else say(`No post called “${esc(arg)}”. Try ${cmdLink('/blog')} to see all posts.`, 'err', 'Error');
        break;
      }
      case 'cat': case 'less': case 'more': case 'bat': case 'open': case 'vim': case 'nano': {
        if (!arg) { say('usage: cat &lt;file&gt; — try ' + cmdLink('cat about.md'), 'err', 'Error'); break; }
        const id = resolvePath(arg);
        if (id) await openDoc(id, el);
        else say(`cat: ${esc(arg)}: No such file. Run ${cmdLink('ls')} to see files.`, 'err', 'Error');
        break;
      }
      case 'ls': case 'll': case 'tree': case 'dir':
        buddy('ls');
        await think(el); el.insertAdjacentHTML('beforeend', `<div class="tool">${lsView(arg.replace(/^-\w+\s*/, ''))}</div>`); break;
      case 'cd':
        say(/blog/.test(arg) ? `You're in <code>~/portfolio/blog</code> now — well, sort of. Try ${cmdLink('ls blog')}.` : 'Staying in <code>~/portfolio</code>. Everything worth seeing is here.'); break;
      case 'pwd': say('/home/visitor/portfolio'); break;
      case 'whoami':
        buddy('whoami');
        say(`<strong>Norman Jazul Jr.</strong> — fullstack developer who specializes in the backend, and loves cloud and security. CS @ UP Cebu. ${cmdLink('/about', 'read more →')}`); break;
      case 'date': say(esc(new Date().toString())); break;
      case 'echo': say(esc(arg)); break;
      case 'sudo': case 'su': case 'chmod': case 'chown':
        await think(el);
        say(`[sudo] password for visitor: <span class="faint">********</span><br />visitor is not in the sudoers file. This incident will be reported. 🔒<br /><span class="dim">(I'm a security guy — least privilege applies here too.)</span>`, 'err', 'Bash');
        break;
      case 'rm': case 'mv': case 'touch': case 'mkdir':
        say(`${esc(cmd)}: read-only file system. Nice try though.`, 'err', 'Error'); break;
      case 'exit': case 'quit': case ':q': case ':wq': case 'logout':
        buddy('exit');
        say(`You're ${pct()}% through my portfolio${pct() < 100 ? ' — stay a bit?' : '. Thanks for reading everything!'} If you want to reach me: ${cmdLink('/contact')}.`); break;
      case '/context':
        buddy('context');
        await think(el); el.insertAdjacentHTML('beforeend', `<div class="tool">${contextView()}</div>`); break;
      case '/compact': {
        await think(el);
        readSet.clear(); saveRead(); updateStatus(); buddy('compact');
        say(`Compacted conversation. Context is back to 0% — read it all again from ${cmdLink('/about')}.`, '', 'Compact');
        try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
        break;
      }
      case '/theme': {
        const cur = document.documentElement.dataset.theme ||
          (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        const next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        store.set(THEME_KEY, next); buddy('theme');
        say(`Theme set to <strong>${next}</strong>.`);
        break;
      }
      default: {
        // forgive missing slash: "about" -> "/about"
        const slashed = DOCS.find(d => d.cmd === '/' + cmd);
        if (slashed && !arg) { await openDoc(slashed.id, el); break; }
        const guess = MENU.find(m => m.cmd.startsWith(cmd.startsWith('/') ? cmd.slice(0, 3) : '/' + cmd.slice(0, 2)));
        say(`Unknown command: <code>${esc(head)}</code>.${guess ? ` Did you mean ${cmdLink(guess.cmd)}?` : ''} Run ${cmdLink('/help')} to see everything.`, 'err', 'Error');
      }
    }
    scrollToEntry(el);
  }

  // serialize command runs
  let queue = Promise.resolve();
  const exec = (text) => { queue = queue.then(() => run(text)).catch(console.error); return queue; };

  // ---------- input, history, slash menu ----------
  const hist = [];
  let histIdx = -1, menuItems = [], menuIdx = 0;

  function renderMenu() {
    const v = input.value;
    if (!v.startsWith('/')) return hideMenu();
    const q = v.toLowerCase();
    menuItems = MENU.filter(m => m.cmd.startsWith(q));
    if (!menuItems.length) menuItems = MENU.filter(m => m.cmd.includes(q.slice(1)) && q.length > 1);
    if (!menuItems.length) return hideMenu();
    menuIdx = Math.min(menuIdx, menuItems.length - 1);
    menu.innerHTML = menuItems.map((m, k) =>
      `<div class="menu-item${k === menuIdx ? ' active' : ''}" role="option" aria-selected="${k === menuIdx}" data-k="${k}">` +
      `<span class="n">${esc(m.cmd)}</span><span class="d">${esc(m.desc)}</span></div>`).join('');
    menu.hidden = false;
    const act = menu.querySelector('.active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function hideMenu() { menu.hidden = true; menuItems = []; menuIdx = 0; }

  function submit(text) {
    hideMenu();
    input.value = '';
    if (text.trim()) { hist.push(text); histIdx = -1; }
    exec(text);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!menu.hidden && menuItems[menuIdx]) return submit(menuItems[menuIdx].cmd);
    submit(input.value);
  });
  input.addEventListener('input', () => { menuIdx = 0; renderMenu(); statusLeft.innerHTML = '<span class="dim">? for shortcuts</span>'; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!menu.hidden && menuItems[menuIdx]) { input.value = menuItems[menuIdx].cmd; renderMenu(); }
      else if (!input.value) { input.value = '/'; renderMenu(); }
      return;
    }
    if (e.key === 'Escape') { hideMenu(); return; }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); hideMenu(); clearScreen(); return; }
    if (e.key === '?' && !input.value) {
      e.preventDefault();
      statusLeft.innerHTML = '<span class="faint">/</span> commands · <span class="faint">tab</span> complete · <span class="faint">↑↓</span> history · <span class="faint">ctrl+l</span> clear';
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const up = e.key === 'ArrowUp';
      if (!menu.hidden) {
        e.preventDefault();
        menuIdx = (menuIdx + (up ? -1 : 1) + menuItems.length) % menuItems.length;
        renderMenu();
        return;
      }
      if (!hist.length) return;
      e.preventDefault();
      if (up) histIdx = histIdx < 0 ? hist.length - 1 : Math.max(0, histIdx - 1);
      else histIdx = histIdx < 0 ? -1 : histIdx + 1;
      if (histIdx >= hist.length) histIdx = -1;
      input.value = histIdx < 0 ? '' : hist[histIdx];
    }
  });
  menu.addEventListener('mousedown', (e) => {
    const it = e.target.closest('.menu-item');
    if (!it) return;
    e.preventDefault();
    submit(menuItems[+it.dataset.k].cmd);
  });

  // clickable commands anywhere
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cmd]');
    if (a) {
      e.preventDefault();
      submit(a.dataset.cmd);
      if (window.matchMedia('(hover: hover)').matches) input.focus();
      return;
    }
    if (e.target.closest('a, button, input, pre, table')) return;
    const sel = window.getSelection();
    if (sel && String(sel).length) return;
    if (window.matchMedia('(hover: hover)').matches) input.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === input || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/' || (e.key.length === 1 && /\S/.test(e.key) && !e.target.closest('a,button'))) input.focus();
  });

  // rotating placeholder, like "Try “…”"
  const tries = ['/about', '/blog drain', 'ls', '/projects', 'cat blog/skolaroid.md', '/context', '/github', 'whoami'];
  let tryIdx = 0;
  setInterval(() => { if (!input.value && document.activeElement !== input) input.placeholder = `Try "${tries[++tryIdx % tries.length]}"`; }, 3500);

  // ---------- boot ----------
  loaded.then(() => {
    updateStatus();
    const p = pct();
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (h && byId[h]) { exec(byId[h].cmd); return; }
    if (p > 0 && p < 100) {
      entry(`<div class="tool">${toolHead('Resume', null, 'info')}${reply(`Welcome back! You've read ${p}% of this portfolio. Pick up where you left off with ${cmdLink('/context')}.`)}</div>`);
    } else if (p >= 100) {
      entry(`<div class="tool">${toolHead('Resume', null, 'info')}${reply(`Welcome back! Your context is already full — you've seen everything. ${cmdLink('/contact')} · ${cmdLink('/compact')}`)}</div>`);
    }
  }).catch(() => {
    entry(`<div class="tool">${toolHead('Error', null, 'err')}${reply('Could not load content files. Serve this folder with a static server (e.g. <code>python3 -m http.server</code>) instead of opening the file directly.')}</div>`);
  });
  if (window.matchMedia('(hover: hover)').matches) input.focus();
})();

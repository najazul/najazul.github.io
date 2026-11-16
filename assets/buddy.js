/* Buddy — the little full-body mascot that reacts to what the visitor does.
 * Shown in three places so it's always visible:
 *   1. the welcome box (full body + speech bubble)
 *   2. floating in the right gutter on wide screens once the welcome box scrolls away
 *   3. a mini face + caption in the bottom status bar (every screen size)
 * app.js talks to it with: document.dispatchEvent(new CustomEvent('buddy', { detail: { type, id } })) */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- poses: 8 lines x 13 columns. E = eye, MMM = mouth ----------
  const HEAD = ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌  ', '  ▐  MMM  ▌  ', '  ▝▀▀▜█▛▀▀▘  '];
  const LEGS = ['    ▐▌ ▐▌    ', '   ▀▀▘ ▝▀▀   '];
  const JUMP = ['   ▐▌   ▐▌   ', '  ▀▀▘   ▝▀▀  '];
  const ARMS_DOWN = ['  ╱▐█████▌╲  ', ' ╱ ▐█████▌ ╲ '];

  const POSES = {
    idle: { eye: '◉', mouth: '╰─╯', mini: '‿', frames: [[...HEAD, ...ARMS_DOWN, ...LEGS]] },
    wave: { eye: '◉', mouth: '╰─╯', mini: '‿', frames: [
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌ o', '  ▐  MMM  ▌ │', '  ▝▀▀▜█▛▀▀▘╱ ', '  ╱▐█████▌   ', ' ╱ ▐█████▌   ', ...LEGS],
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌o ', '  ▐  MMM  ▌│ ', '  ▝▀▀▜█▛▀▀▘│ ', '  ╱▐█████▌   ', ' ╱ ▐█████▌   ', ...LEGS],
    ] },
    cheer: { eye: '^', mouth: '╰▽╯', mini: '▽', frames: [
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌  ', 'o ▐  MMM  ▌ o', ' ╲▝▀▀▜█▛▀▀▘╱ ', '   ▐█████▌   ', '   ▐█████▌   ', ...JUMP],
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌  ', 'o ▐  MMM  ▌ o', ' ╲▝▀▀▜█▛▀▀▘╱ ', '   ▐█████▌   ', '   ▐█████▌   ', ...LEGS],
    ] },
    reading: { eye: '•', mouth: ' ─ ', mini: '_', frames: [
      [...HEAD, '  ╱▐█████▌╲  ', '  ╰[≡≡≡≡≡]╯  ', ...LEGS],
      [...HEAD, '  ╱▐█████▌╲  ', '  ╰[≡≡≡≡ ]╯  ', ...LEGS],
    ] },
    typing: { eye: '◉', mouth: '───', mini: '_', frames: [
      [...HEAD, '  ╱▐█████▌╲  ', ' ┌┴───────┴┐ ', ' │ $ ▌     │ ', ' └─────────┘ '],
      [...HEAD, '  ╱▐█████▌╲  ', ' ┌┴───────┴┐ ', ' │ $       │ ', ' └─────────┘ '],
    ] },
    think: { eye: '•', mouth: ' ~ ', mini: '~', frames: [
      ['  ▗▄▄▄▄▄▄▄▖ ?', '  ▐ E   E ▌  ', '  ▐  MMM  ▌  ', '  ▝▀▀▜█▛▀▀▘╮ ', '  ╱▐█████▌│  ', ' ╱ ▐█████▌╯  ', ...LEGS],
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌  ', '  ▐  MMM  ▌  ', '  ▝▀▀▜█▛▀▀▘╮ ', '  ╱▐█████▌│  ', ' ╱ ▐█████▌╯  ', ...LEGS],
    ] },
    point: { eye: '◉', mouth: '╰─╯', mini: '‿', frames: [
      [...HEAD, '  ╱▐█████▌━━▶', ' ╱ ▐█████▌   ', ...LEGS],
      [...HEAD, '  ╱▐█████▌━▶ ', ' ╱ ▐█████▌   ', ...LEGS],
    ] },
    shield: { eye: '◉', mouth: '───', mini: '_', frames: [
      [...HEAD, '  ╱▐█████▌┏━┓', ' ╱ ▐█████▌┃▣┃', '    ▐▌ ▐▌ ╲━╱', '   ▀▀▘ ▝▀▀   '],
    ] },
    sleepy: { eye: '─', mouth: ' o ', mini: 'o', frames: [
      ['  ▗▄▄▄▄▄▄▄▖ Z', '  ▐ E   E ▌z ', '  ▐  MMM  ▌  ', '  ▝▀▀▜█▛▀▀▘  ', ...ARMS_DOWN, ...LEGS],
      ['  ▗▄▄▄▄▄▄▄▖ z', '  ▐ E   E ▌Z ', '  ▐  MMM  ▌  ', '  ▝▀▀▜█▛▀▀▘  ', ...ARMS_DOWN, ...LEGS],
    ] },
    surprised: { eye: 'O', mouth: ' o ', mini: 'o', frames: [
      ['  ▗▄▄▄▄▄▄▄▖ !', '  ▐ E   E ▌  ', '  ▐  MMM  ▌  ', '  ▝▀▀▜█▛▀▀▘  ', '  ╲▐█████▌╱  ', '   ▐█████▌   ', ...LEGS],
    ] },
    dance: { eye: '^', mouth: '╰▽╯', mini: '▽', frames: [
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌  ', 'o ▐  MMM  ▌  ', '╲ ▝▀▀▜█▛▀▀▘  ', '  ╲▐█████▌╲  ', '   ▐█████▌ o ', ...JUMP],
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌  ', '  ▐  MMM  ▌ o', '  ▝▀▀▜█▛▀▀▘ ╱', '  ╱▐█████▌╱  ', ' o ▐█████▌   ', ...JUMP],
    ] },
    sweat: { eye: '×', mouth: '╭─╮', mini: '~', frames: [
      ['  ▗▄▄▄▄▄▄▄▖  ', "  ▐ E   E ▌ '", '  ▐  MMM  ▌  ', '  ▝▀▀▜█▛▀▀▘  ', ...ARMS_DOWN, ...LEGS],
      ['  ▗▄▄▄▄▄▄▄▖  ', '  ▐ E   E ▌  ', "  ▐  MMM  ▌ '", '  ▝▀▀▜█▛▀▀▘  ', ...ARMS_DOWN, ...LEGS],
    ] },
  };

  // ---------- what it says: up to 4 [pose, caption] per page, picked at random ----------
  const PAGES = {
    home: [['wave', 'Hi! I\'m Norman\'s buddy. Try /about.'], ['point', 'Type a command below, or click one.'], ['idle', 'Welcome! Start with /about.'], ['think', 'Psst — /theme changes my color!']],
    about: [['wave', 'That\'s Norman — nice to meet you!'], ['point', 'Backend is his home turf.'], ['cheer', 'Two championships. Not bad, right?'], ['shield', 'Cloud and security? Big fan.']],
    experience: [['typing', 'Deloitte and SN Intl — real deadlines.'], ['think', 'From Excel pivots to n8n bots.'], ['point', 'The awards are at the bottom.'], ['reading', 'Lots of learning in those internships.']],
    projects: [['point', 'Pick one — /blog explains how.'], ['typing', 'All pulled from GitHub.'], ['cheer', 'drAIn and Skolaroid won awards!'], ['think', 'Which first? Try /blog drain.']],
    blog: [['reading', 'Grab a coffee, these are long-ish.'], ['point', 'Pick a post below.'], ['think', 'One post per project.'], ['typing', 'Real code from the real repos.']],
    'blog/expense-tracker': [['typing', 'C# + .NET — his favorite combo.'], ['reading', 'JWT, R2, Docker… the whole path.'], ['think', 'Free tier sleeps. He kept it awake.'], ['shield', 'Pre-signed URLs are next!']],
    'blog/drain': [['reading', '1 request per second. Rules are rules.'], ['shield', 'Constant-time compare. No timing tricks.'], ['cheer', 'PJDSC 2025 Champion!'], ['think', '"Down" is not "no answer". Big lesson.']],
    'blog/skolaroid': [['shield', 'Frontend makes it easy, backend makes it safe.'], ['point', 'Authenticate → validate → authorize → act.'], ['cheer', 'Best Startup, SE Expo 2026!'], ['reading', 'Invites expire in 7 days. On purpose.']],
    skills: [['typing', 'C#, Python, TS… and SQL, always SQL.'], ['shield', 'Security isn\'t added later.'], ['point', 'Backend first, then cloud.'], ['dance', 'That\'s a lot of tools, huh?']],
    education: [['reading', 'UP Cebu, GWA 1.37.'], ['cheer', 'President\'s Lister!'], ['think', 'AWS Community Day was fun.'], ['point', 'DOST-SEI scholar since 2023.']],
    contact: [['wave', 'Say hi on LinkedIn!'], ['cheer', 'You made it here — let\'s talk!'], ['point', 'Links are right there.'], ['typing', 'He replies faster than a cold start.']],
    github: [['typing', 'Fetched live from the GitHub API.'], ['point', 'These are his public repos.'], ['think', 'Team repos live with teammates.'], ['reading', 'Sorted by latest push.']],
    help: [['point', 'Click any command.'], ['wave', 'Lost? I got you.'], ['think', 'Tip: type / to open the menu.'], ['typing', 'Shell commands work too: ls, cat.']],
    context: [['think', 'This is how much you\'ve read.'], ['point', 'Unread files = more to see.'], ['reading', 'Fill it to 100%!'], ['typing', 'Counting tokens…']],
    ls: [['typing', 'Look at all those files.'], ['point', 'Click one to read it.']],
    whoami: [['wave', 'You\'re a visitor. He\'s Norman.'], ['point', 'More in /about.']],
    clear: [['dance', 'Squeaky clean!'], ['cheer', 'Fresh screen!']],
    compact: [['sleepy', 'Memory wiped… what were we doing?'], ['surprised', 'Back to 0%. Let\'s go again!']],
    theme: [['dance', 'Ooh, new look!'], ['surprised', 'Lights changed!']],
    full: [['cheer', '100%! You\'ve seen everything!'], ['dance', 'Context full! Now /contact him!']],
    error: [['sweat', 'Hmm, I don\'t know that one. /help?'], ['think', 'Typo? Try /help.']],
    sudo: [['shield', 'Nope. Least privilege.'], ['shield', 'Access denied. Nice try!']],
    exit: [['wave', 'Leaving already? /contact first!'], ['sweat', 'Wait, don\'t go yet!']],
  };
  const REACT = {
    click: [['surprised', 'Oh! Clicking around?'], ['point', 'The commands are below.'], ['think', 'Looking for something? /help'], ['wave', 'Hi there!']],
    poke: [['surprised', 'Hey! That tickles.'], ['dance', 'Boop!'], ['sweat', 'I\'m working here!'], ['cheer', 'Again? Okay, okay!']],
    highlight: [['surprised', 'Ooh, highlighting! Copy away.'], ['reading', 'Good part, right?'], ['think', 'Want the code? It\'s on GitHub.'], ['point', 'Taking notes? Love it.']],
    link: [['wave', 'See you there — come back after!'], ['point', 'Opening in a new tab.']],
    typing: [['typing', 'Ooh, what are we running?'], ['think', 'Tab completes commands.']],
    long: [['think', 'Still reading? Take your time.'], ['reading', 'Long one, huh?'], ['point', 'When ready: /context shows what\'s left.'], ['sleepy', '…oh! Still here?']],
    asleep: [['sleepy', 'zZz… type anything to wake me.']],
    back: [['surprised', 'Oh! You\'re back!'], ['wave', 'Welcome back!']],
  };

  // ---------- dom ----------
  const welcomeLeft = document.querySelector('.welcome-left');
  const oldMascot = welcomeLeft && welcomeLeft.querySelector('.mascot');
  const mk = (cls) => {
    const w = document.createElement('div');
    w.className = 'buddy ' + cls;
    w.innerHTML = '<div class="bubble" aria-live="polite"></div><pre class="buddy-art" aria-hidden="true"></pre>';
    return w;
  };
  const home = mk('buddy-home');
  if (oldMascot) oldMascot.replaceWith(home); else if (welcomeLeft) welcomeLeft.prepend(home);
  const float = mk('buddy-float');
  float.title = 'Poke me';
  document.body.appendChild(float);
  const views = [home, float];
  const mini = document.getElementById('buddy-mini');
  const statusLeft = mini && mini.parentElement;

  // show the floating buddy only when the welcome one is scrolled out of view
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => float.classList.toggle('show', !e.isIntersecting), { root: document.getElementById('term'), threshold: 0.15 })
      .observe(home);
  }

  // ---------- state + render ----------
  let base = { pose: 'idle', caption: '' };   // the page's pose
  let current = base;                          // what's showing now (base or a short reaction)
  let frame = 0, blink = false, revertT = null, miniT = null;
  const lastPick = {};

  function draw() {
    const p = POSES[current.pose] || POSES.idle;
    const lines = p.frames[frame % p.frames.length];
    const eye = blink && p.eye !== '─' ? '─' : p.eye;
    const art = lines.map(l => l.replace(/E/g, eye).replace('MMM', p.mouth)).join('\n');
    for (const v of views) {
      v.querySelector('.buddy-art').textContent = art;
      v.querySelector('.bubble').textContent = current.caption;
    }
  }
  function show(next, { transient = false } = {}) {
    current = next; frame = 0;
    draw();
    for (const v of views) {
      v.classList.remove('bump');
      if (!reduceMotion) { void v.offsetWidth; v.classList.add('bump'); }
    }
    if (mini) {
      const p = POSES[next.pose] || POSES.idle;
      mini.innerHTML = '';
      const face = document.createElement('span');
      face.className = 'face';
      face.textContent = `(${p.eye}${p.mini}${p.eye})`;
      const cap = document.createElement('span');
      cap.className = 'cap';
      cap.textContent = next.caption;
      mini.append(face, cap);
      statusLeft.classList.add('talking');
      clearTimeout(miniT);
      miniT = setTimeout(() => statusLeft.classList.remove('talking'), 6000);
    }
    clearTimeout(revertT);
    if (transient) revertT = setTimeout(() => { current = base; frame = 0; draw(); }, 4000);
  }
  function pick(pool, key) {
    if (!pool || !pool.length) return null;
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === lastPick[key]) i = (i + 1) % pool.length;
    lastPick[key] = i;
    return { pose: pool[i][0], caption: pool[i][1] };
  }
  const page = (id) => { const p = pick(PAGES[id], 'p:' + id); if (p) { base = p; show(p); } };
  const react = (kind) => { const p = pick(REACT[kind], 'r:' + kind); if (p) show(p, { transient: true }); };

  // animation loop: cycle frames + blink now and then
  if (!reduceMotion) {
    setInterval(() => { frame++; draw(); }, 550);
    (function blinkLoop() {
      setTimeout(() => { blink = true; draw(); setTimeout(() => { blink = false; draw(); blinkLoop(); }, 140); }, 2500 + Math.random() * 3500);
    })();
  }

  // ---------- events from app.js ----------
  document.addEventListener('buddy', (e) => {
    const { type, id } = e.detail || {};
    activity(true);
    if (type === 'page') page(id);
  });

  // ---------- visitor behaviour ----------
  let lastReact = 0;
  const throttled = (kind, ms = 2500) => { const t = Date.now(); if (t - lastReact < ms) return; lastReact = t; react(kind); };

  document.addEventListener('click', (e) => {
    if (e.target.closest('.buddy')) { lastReact = Date.now(); react('poke'); return; }
    if (e.target.closest('[data-cmd], [data-pal], [data-mode]')) return;               // page reaction comes from app.js
    if (e.target.closest('a[href^="http"]')) { lastReact = Date.now(); react('link'); return; }
    if (e.target.closest('input, button, .menu')) return;
    const sel = window.getSelection();
    if (sel && String(sel).trim()) return;                     // that's highlighting, handled below
    throttled('click');
  });

  let selT = null, lastSel = '';
  document.addEventListener('selectionchange', () => {
    clearTimeout(selT);
    selT = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? String(sel).trim() : '';
      if (text.length < 4 || text === lastSel) return;
      const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      if (!node || !node.closest('#log, .welcome')) return;
      lastSel = text;
      lastReact = Date.now();
      react('highlight');
    }, 450);
  });

  const input = document.getElementById('cmd');
  if (input) input.addEventListener('input', () => { if (input.value.length === 1) throttled('typing', 8000); });

  // staying too long on one page
  const LONG_MS = 45000, SLEEP_MS = 120000;
  let lastActive = Date.now(), stage = 0, lastMove = 0;
  function activity(fromCommand) {
    const wasAsleep = stage === 2;
    lastActive = Date.now();
    stage = 0;
    if (wasAsleep && !fromCommand) react('back');
    else if (wasAsleep) { /* the page reaction will show */ }
  }
  ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => activity(false), { passive: true }));
  document.addEventListener('mousemove', () => { const t = Date.now(); if (t - lastMove > 1000) { lastMove = t; if (stage === 2) activity(false); else lastActive = t; } }, { passive: true });
  const term = document.getElementById('term');
  if (term) term.addEventListener('scroll', () => { if (stage !== 2) lastActive = Date.now(); }, { passive: true });
  setInterval(() => {
    const idle = Date.now() - lastActive;
    if (stage === 0 && idle > LONG_MS) { stage = 1; react('long'); }
    else if (stage === 1 && idle > SLEEP_MS) { stage = 2; clearTimeout(revertT); const p = pick(REACT.asleep, 'asleep'); show(p); }
  }, 3000);

  page('home');
})();

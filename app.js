import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, COUPLE_EMAIL, PROFILES } from './config.js';
import { sceneHtml, DEFAULT_ART } from './scenes.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dates-auth' },
});

// ---------------- state ----------------
const S = {
  me: lsGet('dates-profile'),
  tab: 'home',
  voteMode: 'random',
  ideas: [],
  votes: [],      // {idea_id, profile, value}
  dates: [],
  notes: [],      // date_notes
  messages: [],
  currentIdeaId: null,
  unread: 0,
  lastSeenMsg: Number(lsGet('dates-last-seen') || 0),
  channel: null,
};

const CAT = {
  food:        { label: 'אוכל',        em: '🍽️' },
  spa:         { label: 'ספא ופינוק',  em: '💆‍♀️' },
  shopping:    { label: 'קניות',        em: '🛍️' },
  experiences: { label: 'חוויות',       em: '🎭' },
  people:      { label: 'עם חברים',     em: '🥂' },
};
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/></svg>',
  vote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/></svg>',
  dates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="12" cy="15" r="1.6" fill="currentColor"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6a3.5 3.5 0 0 1-3.5 3.5H10l-4.5 4v-4.2A3.5 3.5 0 0 1 4 12.5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
};
const COUPLE = 'icons/couple.svg';
const DUR = {
  short: 'עד שעתיים', evening: 'ערב', halfday: 'חצי יום', fullday: 'יום שלם', overnight: 'לילה',
};

// ---------------- helpers ----------------
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch {} }
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = (p) => PROFILES[p]?.name ?? '';
const partner = () => PROFILES[S.me]?.partner;

function toast(text) {
  const t = $('#toast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
}

function todayStr(offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD local
}
function fmtDate(dstr) {
  if (!dstr) return '';
  if (dstr === todayStr()) return 'היום';
  if (dstr === todayStr(1)) return 'מחר';
  const d = new Date(dstr + 'T12:00:00');
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}
const fmtTime = (t) => (t ? t.slice(0, 5) : '');
// "היום בשעה 20:00" / "מחר בשעה 20:00" / "ביום שלישי, 10.11, בשעה 20:00"
function whenText(d) {
  const t = d.time_at ? ` בשעה ${fmtTime(d.time_at)}` : '';
  if (d.date_on === todayStr()) return `היום${t}`;
  if (d.date_on === todayStr(1)) return `מחר${t}`;
  const dt = new Date(d.date_on + 'T12:00:00');
  const wd = dt.toLocaleDateString('he-IL', { weekday: 'long' });
  return `ב${wd}, ${dt.getDate()}.${dt.getMonth() + 1}${t ? ',' + t : ''}`;
}
const notesOf = (dateId) => S.notes.filter((n) => n.date_id === dateId);
const avatar = (p, cls = '') => `<span class="av av-${p} ${cls}"><img src="icons/${p}.svg" alt="${nameOf(p)}"></span>`;
const ideaById = (id) => S.ideas.find((i) => i.id === id);
const voteOf = (ideaId, profile) => S.votes.find((v) => v.idea_id === ideaId && v.profile === profile)?.value ?? 0;
const isMatch = (ideaId) => voteOf(ideaId, 'tal') === 1 && voteOf(ideaId, 'eilat') === 1;

// ---------------- boot ----------------
boot();

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const { data } = await sb.auth.getSession();
  if (!data.session) return renderLogin();
  if (!S.me || !PROFILES[S.me]) return renderPicker();
  await startApp();
}

function renderLogin(errText = '') {
  $('#app').innerHTML = `
    <div class="center-screen"><div class="hero">
      <div class="couple"><img src="${COUPLE}" alt=""></div>
      <h1>הדייטים שלנו</h1>
      <p>מקום קטן רק לשניכם, לתכנן את הפינוק הבא.</p>
      <form id="login-form">
        <label class="field"><span>הקוד הזוגי</span>
          <input id="code" type="password" autocomplete="current-password" placeholder="הקוד ששניכם בחרתם" required>
        </label>
        <button class="btn" type="submit">כניסה</button>
        <div class="err">${esc(errText)}</div>
      </form>
    </div></div>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: COUPLE_EMAIL, password: $('#code').value });
    if (error) return renderLogin('הקוד לא נכון. נסו שוב.');
    S.me && PROFILES[S.me] ? startApp() : renderPicker();
  });
}

function renderPicker() {
  $('#app').innerHTML = `
    <div class="center-screen"><div class="hero">
      <h1>מי מחזיק את הטלפון?</h1>
      <p>בוחרים פעם אחת במכשיר הזה.</p>
      <div class="pick">
        <button data-pick="tal"><span class="face"><img src="icons/tal.svg" alt=""></span>אני טל</button>
        <button data-pick="eilat"><span class="face"><img src="icons/eilat.svg" alt=""></span>אני אילת</button>
      </div>
    </div></div>`;
  $('#app').querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => { S.me = b.dataset.pick; lsSet('dates-profile', S.me); startApp(); }));
}

async function startApp() {
  const params = new URLSearchParams(location.search);
  if (params.get('tab')) S.tab = params.get('tab');
  renderShell();
  await loadAll();
  subscribe();
  render();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAll().then(render); });
}

async function loadAll() {
  const [ideas, votes, dates, msgs, notes] = await Promise.all([
    sb.from('ideas').select('*').order('id'),
    sb.from('votes').select('*'),
    sb.from('dates').select('*').order('date_on').order('time_at', { nullsFirst: false }),
    sb.from('messages').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('date_notes').select('*').order('created_at'),
  ]);
  if (ideas.error?.status === 401 || ideas.error?.code === 'PGRST301') { await sb.auth.signOut(); return renderLogin(); }
  S.ideas = ideas.data || [];
  S.votes = votes.data || [];
  S.dates = dates.data || [];
  S.messages = (msgs.data || []).reverse();
  S.notes = notes.data || [];
  computeUnread();
}

function subscribe() {
  if (S.channel) sb.removeChannel(S.channel);
  S.channel = sb.channel('couple')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => {
      if (p.eventType === 'INSERT') {
        if (!S.messages.some((m) => m.id === p.new.id)) S.messages.push(p.new);
        if (p.new.profile !== S.me && S.tab !== 'chat') toast(`💬 ${nameOf(p.new.profile)}: ${p.new.body || 'שלח/ה רעיון'}`);
      } else if (p.eventType === 'DELETE') {
        S.messages = S.messages.filter((m) => m.id !== p.old.id);
      }
      computeUnread(); render();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, async () => {
      const { data } = await sb.from('votes').select('*'); S.votes = data || []; render(true);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dates' }, async () => {
      const { data } = await sb.from('dates').select('*').order('date_on').order('time_at', { nullsFirst: false });
      S.dates = data || []; render(true);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'date_notes' }, async () => {
      const { data } = await sb.from('date_notes').select('*').order('created_at'); S.notes = data || []; render(true);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, async () => {
      const { data } = await sb.from('ideas').select('*').order('id'); S.ideas = data || []; render(true);
    })
    .subscribe();
}

function computeUnread() {
  if (S.tab === 'chat') {
    const last = S.messages.at(-1);
    if (last) { S.lastSeenMsg = last.id; lsSet('dates-last-seen', String(last.id)); }
  }
  S.unread = S.messages.filter((m) => m.id > S.lastSeenMsg && m.profile !== S.me).length;
}

// ---------------- shell ----------------
function renderShell() {
  $('#app').innerHTML = `
    <header class="topbar">
      <h1 id="title"></h1>
      <button class="who" id="who" title="החלפת משתמש"></button>
    </header>
    <main id="main"></main>
    <div id="composer-slot"></div>
    <nav class="tabbar" id="tabbar">
      ${[['home', 'בית'], ['vote', 'הצבעה'], ['dates', 'דייטים'], ['chat', 'צ׳אט']]
        .map(([k, l]) => `<button data-tab="${k}">${ICON[k]}${l}</button>`).join('')}
    </nav>`;
  $('#tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    go(b.dataset.tab);
  });
  $('#who').addEventListener('click', openSettings);
  $('#main').addEventListener('click', onMainClick);
  $('#main').addEventListener('submit', async (e) => {
    const f = e.target.closest('.note-add'); if (!f) return;
    e.preventDefault();
    const input = f.querySelector('input'); const body = input.value.trim(); if (!body) return;
    input.value = '';
    const { data, error } = await sb.from('date_notes').insert({ date_id: Number(f.dataset.date), profile: S.me, body }).select().single();
    if (error) return toast('ההערה לא נשמרה');
    if (!S.notes.some((n) => n.id === data.id)) S.notes.push(data);
    render();
  });
}

function go(tab) {
  S.tab = tab; computeUnread(); render(); window.scrollTo(0, 0);
  if (tab === 'chat') requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
}

let lastRenderKey = '';
function render(soft = false) {
  const titles = { home: 'הדייטים שלנו', vote: 'מה עושים השבוע?', dates: 'היומן שלנו', chat: `צ׳אט עם ${nameOf(partner())}` };
  $('#title').textContent = titles[S.tab];
  $('#who').innerHTML = `${avatar(S.me)}${nameOf(S.me)}`;
  $('#tabbar').querySelectorAll('[data-tab]').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === S.tab);
    b.querySelector('.badge')?.remove();
    if (b.dataset.tab === 'chat' && S.unread > 0) b.insertAdjacentHTML('beforeend', `<span class="badge">${S.unread}</span>`);
  });
  // keep the current random idea stable on soft re-renders
  if (soft && S.tab === 'vote' && S.voteMode === 'random') {
    if (S.dragging) return;
    $('#main').innerHTML = viewVote(); bindSwipe(); return;
  }
  if (soft && document.activeElement?.matches?.('.note-input')) return; // don't wipe a note being typed
  const views = { home: viewHome, vote: viewVote, dates: viewDates, chat: viewChat };
  const wasAtBottom = S.tab === 'chat' && (window.innerHeight + window.scrollY >= document.body.scrollHeight - 80);
  $('#main').innerHTML = views[S.tab]();
  $('#composer-slot').innerHTML = S.tab === 'chat' ? composerHtml() : '';
  if (S.tab === 'chat') bindComposer();
  if (S.tab === 'vote' && S.voteMode === 'random') bindSwipe();
  const key = S.tab + S.messages.length;
  if (S.tab === 'chat' && (wasAtBottom || key !== lastRenderKey)) window.scrollTo(0, document.body.scrollHeight);
  lastRenderKey = key;
}

// ---------------- views ----------------
function upcoming() {
  const t = todayStr();
  return S.dates.filter((d) => d.status === 'planned' && d.date_on >= t);
}

function viewHome() {
  const up = upcoming();
  const today = up.filter((d) => d.date_on === todayStr());
  const matches = S.ideas.filter((i) => isMatch(i.id));
  const pendingForMe = S.ideas.filter((i) => voteOf(i.id, partner()) === 1 && voteOf(i.id, S.me) === 0);
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'לילה טוב' : hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב';
  const next = up.find((d) => d.date_on !== todayStr());
  const focus = today[0] || next;
  const sub = focus
    ? `<p>יש לכם דייט ${esc(whenText(focus))}</p><p class="what">${esc(focus.title)}${focus.place ? ', ' + esc(focus.place) : ''}</p>`
    : '<p>עוד לא קבעתם דייט. מה עושים השבוע?</p>';

  let html = `<section class="home-hero">
    <div class="txt"><div class="hello">${hello},</div><h2>${esc(nameOf(S.me))}</h2>${sub}</div>
    <img src="${COUPLE}" alt="טל ואילת">
  </section>`;

  for (const d of today) {
    html += `<div class="reminder">
      <div class="kicker">⏰ ${esc(whenText(d))}</div>
      <h2>${esc(d.title)}</h2>
      ${d.place ? `<div>📍 ${esc(d.place)}</div>` : ''}
      ${notesBlock(d)}
    </div>`;
  }

  if (!today.length && !next) {
    html += `<div class="card"><h3 style="font-size:21px">עוד לא קבעתם דייט השבוע</h3>
      <p class="muted" style="margin:6px 0 14px">מגרילים רעיון, כל אחד מצביע, וכשיש התאמה קובעים.</p>
      <button class="btn" data-act="goto" data-tab="vote">🎲 להגריל רעיון</button></div>`;
  }

  html += `<div class="tiles">
    <button class="tile mint" data-act="goto" data-tab="vote" data-mode="matches">
      <span class="big">${matches.length}</span><div><b>התאמות</b><br><span>רעיונות ששניכם אהבתם</span></div>
    </button>
    <button class="tile sky" data-act="goto" data-tab="chat">
      <span class="big">${S.unread || '💬'}</span><div><b>${S.unread ? 'הודעות חדשות' : 'צ׳אט'}</b><br><span>לדבר על הדייט הבא</span></div>
    </button>
  </div>`;

  if (next) html += `<h3 class="section-title">הדייט הבא</h3>${dateCard(next)}`;

  if (pendingForMe.length) {
    html += `<div class="card" style="margin-top:14px"><b>${esc(nameOf(partner()))} אהב/ה ${pendingForMe.length === 1 ? 'רעיון שעוד לא הצבעת עליו' : pendingForMe.length + ' רעיונות שעוד לא הצבעת עליהם'}</b>
      <p class="muted small" style="margin:4px 0 12px">אולי מחכה לכם פה התאמה.</p>
      <button class="btn small violet" data-act="vote-pending">להצביע</button></div>`;
  }
  return html;
}

function pickRandomIdea(preferPending = false) {
  const pool = S.ideas.filter((i) => voteOf(i.id, S.me) === 0);
  const pending = pool.filter((i) => voteOf(i.id, partner()) === 1);
  const src = preferPending && pending.length ? pending : (pool.length ? pool : S.ideas);
  const others = src.filter((i) => i.id !== S.currentIdeaId);
  const arr = others.length ? others : src;
  S.currentIdeaId = arr.length ? arr[Math.floor(Math.random() * arr.length)].id : null;
}

function viewVote() {
  let html = `<div class="seg">
    <button data-act="vmode" data-mode="random" class="${S.voteMode === 'random' ? 'on' : ''}">🎲 רעיון אקראי</button>
    <button data-act="vmode" data-mode="matches" class="${S.voteMode === 'matches' ? 'on' : ''}">💞 התאמות</button>
  </div>`;

  if (S.voteMode === 'matches') {
    const matches = S.ideas.filter((i) => isMatch(i.id));
    const theyLiked = S.ideas.filter((i) => voteOf(i.id, partner()) === 1 && voteOf(i.id, S.me) !== 1);
    if (!matches.length) {
      html += `<div class="empty"><span class="ic">💞</span>עוד אין התאמות.<br>כששניכם אוהבים את אותו רעיון, הוא יופיע כאן.</div>`;
    } else {
      html += matches.map((i) => ideaRow(i, true)).join('');
    }
    if (theyLiked.length) {
      html += `<h3 class="section-title">${esc(nameOf(partner()))} אהב/ה</h3>` + theyLiked.map((i) => ideaRow(i, false)).join('');
    }
    html += `<div class="foot"><button class="linkish" data-act="add-idea">+ להוסיף רעיון משלנו</button></div>`;
    return html;
  }

  if (!S.currentIdeaId || !ideaById(S.currentIdeaId)) pickRandomIdea(true);
  const idea = ideaById(S.currentIdeaId);
  if (!idea) return html + `<div class="empty"><span class="ic">🌱</span>אין עדיין רעיונות במאגר.</div>`;

  const mine = voteOf(idea.id, S.me);
  const theirs = voteOf(idea.id, partner());
  const pn = nameOf(partner());
  let note = '';
  if (isMatch(idea.id)) note = `💞 יש התאמה! שניכם אהבתם`;
  else if (theirs === 1) note = `${esc(pn)} אהב/ה את זה 💕`;
  else if (theirs === -1) note = `${esc(pn)} פחות התלהב/ה מזה`;

  html += `<div class="swipe-hint">גררו את הכרטיס הצידה לרעיון הבא</div>
  <div class="card-stage"><div class="idea-card cat-${idea.category} ${S.enterFrom ? 'enter-' + S.enterFrom : ''}" id="swipe-card">
    <div class="idea-art">${sceneHtml(idea)}<span class="price">כ-${idea.cost} ₪</span></div>
    <div class="idea-body">
      <h2>${esc(idea.title)}</h2>
      ${idea.description ? `<p class="muted" style="margin:0">${esc(idea.description)}</p>` : ''}
      <div class="chips">
        <span class="chip cat">${CAT[idea.category]?.label ?? ''}</span>
        <span class="chip">${DUR[idea.duration] ?? ''}</span>
        ${mine === 1 ? '<span class="chip love">אהבת ♥</span>' : mine === -1 ? '<span class="chip">סימנת לא</span>' : ''}
      </div>
      ${note ? `<div class="partner-note ${isMatch(idea.id) ? 'match' : ''}">${note}</div>` : ''}
    </div>
  </div></div>
  <div class="vote-actions">
    <button class="round no" data-act="vote" data-v="-1">✕ לא בשבילי</button>
    <button class="round dice" data-act="next" aria-label="רעיון אחר">🎲</button>
    <button class="round yes" data-act="vote" data-v="1">♥ אהבתי</button>
  </div>
  <div class="idea-tools">
    <button class="btn ghost small" data-act="to-chat" data-id="${idea.id}">💬 לדבר על זה</button>
    <button class="btn small violet" data-act="schedule" data-id="${idea.id}">📅 קבעו דייט</button>
  </div>
  <div class="foot"><button class="linkish" data-act="add-idea">+ להוסיף רעיון משלנו</button></div>`;
  return html;
}

function ideaRow(i, matched) {
  return `<div class="list-item cat-${i.category}">
    <div class="em">${CAT[i.category]?.em ?? '✨'}</div>
    <div class="txt"><b>${esc(i.title)}</b><span class="muted small">${DUR[i.duration] ?? ''}, כ-${i.cost} ₪</span></div>
    <div class="acts">
      ${matched ? `<button class="btn small violet" data-act="schedule" data-id="${i.id}">📅 קבעו</button>`
                : `<button class="btn small" data-act="vote-id" data-id="${i.id}" data-v="1">♥ גם אני</button>`}
      <button class="btn small ghost" data-act="to-chat" data-id="${i.id}">💬</button>
    </div>
  </div>`;
}

function dateCard(d) {
  const past = d.status !== 'planned' || d.date_on < todayStr();
  const dt = new Date(d.date_on + 'T12:00:00');
  const status = d.status === 'done' ? ', היה ✓' : d.status === 'cancelled' ? ', בוטל' : '';
  return `<div class="date-card ${past ? 'past' : ''}">
    <div class="cal"><div class="d">${dt.getDate()}</div><div class="m">${dt.toLocaleDateString('he-IL', { month: 'short' })}</div></div>
    <div>
      <div class="when">${fmtDate(d.date_on)}${d.time_at ? ', ' + fmtTime(d.time_at) : ''}</div>
      <h3>${esc(d.title)}</h3>
      ${d.place ? `<div class="muted small">📍 ${esc(d.place)}</div>` : ''}
      ${notesBlock(d, !past)}
      <div class="muted small" style="margin-top:6px">${esc(nameOf(d.created_by))} קבע/ה${status}</div>
      <div class="acts">
        <button class="btn small ghost" data-act="edit-date" data-id="${d.id}">עריכה</button>
        ${d.status === 'planned' ? `<button class="btn small ghost" data-act="done-date" data-id="${d.id}">✓ היה</button>` : ''}
      </div>
    </div>
  </div>`;
}

function notesBlock(d, canAdd = true) {
  const list = notesOf(d.id);
  // older dates may still carry a single note on the date row itself
  const legacy = d.notes ? [{ id: 'l' + d.id, profile: d.created_by, body: d.notes }] : [];
  const all = legacy.concat(list);
  return `<div class="notes">
    ${all.map((n) => `<div class="note-row">${avatar(n.profile, 'sm')}<div><b>${esc(nameOf(n.profile))}</b> ${esc(n.body)}</div>
      ${n.profile === S.me && typeof n.id === 'number' ? `<button class="x" data-act="del-note" data-id="${n.id}" aria-label="מחיקה">✕</button>` : ''}</div>`).join('')}
    ${canAdd ? `<form class="note-add" data-date="${d.id}"><input class="note-input" placeholder="+ הוספת הערה" maxlength="140"><button aria-label="הוספה">${ICON.plus}</button></form>` : ''}
  </div>`;
}

function viewDates() {
  const up = upcoming();
  const past = S.dates.filter((d) => !up.includes(d)).reverse();
  let html = '';
  html += `<button class="btn" style="margin:6px 0 4px" data-act="schedule-free">📅 לקבוע דייט חדש</button>`;
  html += `<h3 class="section-title">מתוכננים</h3>`;
  html += up.length ? up.map(dateCard).join('') : `<div class="empty"><span class="ic">🗓️</span>אין דייטים מתוכננים כרגע.</div>`;
  if (past.length) html += `<h3 class="section-title">היו</h3>` + past.slice(0, 20).map(dateCard).join('');
  return html;
}

function viewChat() {
  if (!S.messages.length) {
    return `<div class="empty"><span class="ic">💬</span>כאן מדברים על הדייט הבא.<br>אפשר גם לשלוח רעיון מההצבעה.</div><div class="chat"></div>`;
  }
  let html = '<div class="chat">';
  let lastDay = '';
  for (const m of S.messages) {
    const day = new Date(m.created_at).toLocaleDateString('en-CA');
    if (day !== lastDay) { html += `<div class="day-sep">${fmtDate(day)}</div>`; lastDay = day; }
    const idea = m.idea_id ? ideaById(m.idea_id) : null;
    const time = new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    html += `<div class="msg ${m.profile === S.me ? 'me' : 'them'}"><span class="body">${esc(m.body || '')}</span>${idea ? `
      <div class="attached cat-${idea.category}"><div class="strip">${CAT[idea.category]?.em ?? ''}</div><div class="in">
        <b>${esc(idea.title)}</b><span class="small muted">${DUR[idea.duration] ?? ''}, כ-${idea.cost} ₪</span>
        <div><button data-act="schedule" data-id="${idea.id}">📅 קבעו דייט</button>${voteOf(idea.id, S.me) !== 1 ? `<button data-act="vote-id" data-id="${idea.id}" data-v="1">♥ אהבתי</button>` : ''}</div>
      </div></div>` : ''}<span class="meta">${time}</span></div>`;
  }
  return html + '</div>';
}

function composerHtml() {
  return `<form class="composer" id="composer">
    <button type="button" class="attach" data-act-c="attach" aria-label="שליחת רעיון">🎲</button>
    <textarea id="msg" rows="1" placeholder="מה בא לך השבוע?"></textarea>
    <button class="send" type="submit" aria-label="שליחה">${ICON.send}</button>
  </form>`;
}
function bindComposer() {
  const f = $('#composer'); const ta = $('#msg');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) return;
    ta.value = ''; ta.style.height = '';
    await sendMessage({ body });
  });
  f.querySelector('[data-act-c="attach"]').addEventListener('click', () => {
    const pool = S.ideas.filter((i) => voteOf(i.id, S.me) !== -1);
    const idea = pool[Math.floor(Math.random() * pool.length)];
    if (idea) sendMessage({ body: 'מה דעתך על זה? 🎲', idea_id: idea.id });
  });
}

async function sendMessage({ body, idea_id = null }) {
  const { data, error } = await sb.from('messages').insert({ profile: S.me, body, idea_id }).select().single();
  if (error) return toast('ההודעה לא נשלחה, נסו שוב');
  if (!S.messages.some((m) => m.id === data.id)) S.messages.push(data);
  computeUnread(); if (S.tab === 'chat') render();
}

// ---------------- actions ----------------
async function onMainClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id ? Number(b.dataset.id) : null;
  switch (b.dataset.act) {
    case 'goto': if (b.dataset.mode) S.voteMode = b.dataset.mode; go(b.dataset.tab); break;
    case 'vmode': S.voteMode = b.dataset.mode; render(); break;
    case 'next': nextIdea('left'); break;
    case 'del-note': await sb.from('date_notes').delete().eq('id', id); S.notes = S.notes.filter((n) => n.id !== id); render(); break;
    case 'vote-pending': S.voteMode = 'random'; S.currentIdeaId = null; pickRandomIdea(true); go('vote'); break;
    case 'vote': await castVote(S.currentIdeaId, Number(b.dataset.v), true); break;
    case 'vote-id': await castVote(id, Number(b.dataset.v), false); break;
    case 'to-chat': await sendMessage({ body: 'מה דעתך על זה? 💭', idea_id: id }); go('chat'); break;
    case 'schedule': openSchedule({ idea: ideaById(id) }); break;
    case 'schedule-free': openSchedule({}); break;
    case 'edit-date': openSchedule({ date: S.dates.find((d) => d.id === id) }); break;
    case 'done-date': await sb.from('dates').update({ status: 'done' }).eq('id', id); toast('איזה כיף! ✓'); break;
    case 'add-idea': openAddIdea(); break;
  }
}

function nextIdea(dir) {
  pickRandomIdea();
  S.enterFrom = dir === 'left' ? 'right' : 'left';
  render();
  S.enterFrom = null;
}

// drag the idea card sideways to get the next idea
function bindSwipe() {
  const card = $('#swipe-card'); if (!card) return;
  let x0 = 0, y0 = 0, dx = 0, active = false, horizontal = null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    active = true; horizontal = null; x0 = e.clientX; y0 = e.clientY; dx = 0;
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - x0; const dy = e.clientY - y0;
    if (horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal) { card.setPointerCapture(e.pointerId); S.dragging = true; }
    }
    if (!horizontal) return;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
  });
  const end = () => {
    if (!active) return; active = false;
    if (!horizontal) return;
    S.dragging = false;
    if (Math.abs(dx) > 80) {
      const dir = dx < 0 ? 'left' : 'right';
      if (reduce) return nextIdea(dir);
      card.style.transition = 'transform .25s ease-in, opacity .25s';
      card.style.transform = `translateX(${dx < 0 ? -140 : 140}%) rotate(${dx < 0 ? -18 : 18}deg)`;
      card.style.opacity = '0';
      setTimeout(() => nextIdea(dir), 220);
    } else {
      card.style.transition = 'transform .3s cubic-bezier(.2,1.4,.4,1)';
      card.style.transform = '';
    }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

async function castVote(ideaId, value, advance) {
  if (!ideaId) return;
  const row = { idea_id: ideaId, profile: S.me, value, updated_at: new Date().toISOString() };
  S.votes = S.votes.filter((v) => !(v.idea_id === ideaId && v.profile === S.me)).concat(row);
  const { error } = await sb.from('votes').upsert(row);
  if (error) return toast('ההצבעה לא נשמרה');
  if (value === 1 && isMatch(ideaId)) {
    toast('💞 יש התאמה! אפשר לקבוע דייט');
    openSchedule({ idea: ideaById(ideaId) });
  } else if (advance) {
    return nextIdea(value === 1 ? 'right' : 'left');
  }
  render();
}

// ---------------- sheets ----------------
function openSheet(html, onMount) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"><div class="sheet"><div class="grab"></div>${html}</div></div>`;
  const bd = root.firstElementChild;
  bd.addEventListener('click', (e) => { if (e.target === bd || e.target.closest('[data-close]')) closeSheet(); });
  onMount?.(bd.querySelector('.sheet'));
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }

function openSchedule({ idea = null, date = null }) {
  const d = date || {};
  const title = d.title || idea?.title || '';
  openSheet(`
    <h2>${date ? 'עריכת דייט' : '📅 קביעת דייט'}</h2>
    <form id="sched">
      <label class="field"><span>מה עושים</span><input name="title" required value="${esc(title)}" placeholder="למשל: מסעדת שף"></label>
      <div class="row2">
        <label class="field"><span>תאריך</span><input name="date_on" type="date" required value="${esc(d.date_on || '')}" min="${date ? '' : todayStr()}"></label>
        <label class="field"><span>שעה</span><input name="time_at" type="time" value="${esc(fmtTime(d.time_at))}"></label>
      </div>
      <label class="field"><span>איפה (לא חובה)</span><input name="place" value="${esc(d.place || '')}" placeholder="שם המקום או העיר"></label>
      ${date ? '' : '<label class="field"><span>הערה ראשונה (לא חובה)</span><input name="notes" placeholder="למשל: לארגן בייביסיטר"></label>'}
      <div class="btns">
        <button class="btn " type="submit">${date ? 'שמירה' : 'קובעים! ♥'}</button>
        ${date && d.status === 'planned' ? '<button class="btn ghost" type="button" data-cancel>ביטול הדייט</button>' : ''}
        <button class="btn ghost" type="button" data-close>סגירה</button>
      </div>
    </form>`, (sheet) => {
    sheet.querySelector('[data-cancel]')?.addEventListener('click', async () => {
      await sb.from('dates').update({ status: 'cancelled' }).eq('id', d.id);
      closeSheet(); toast('הדייט בוטל');
    });
    sheet.querySelector('#sched').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const row = {
        title: fd.title.trim(), date_on: fd.date_on, time_at: fd.time_at || null,
        place: fd.place.trim() || null,
      };
      const firstNote = (fd.notes || '').trim();
      const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      let res;
      if (date) res = await sb.from('dates').update(row).eq('id', d.id);
      else res = await sb.from('dates').insert({ ...row, idea_id: idea?.id ?? null, created_by: S.me }).select().single();
      if (res.error) { btn.disabled = false; return toast('לא נשמר, נסו שוב'); }
      if (!date) {
        if (firstNote) {
          const n = await sb.from('date_notes').insert({ date_id: res.data.id, profile: S.me, body: firstNote }).select().single();
          if (n.data) S.notes.push(n.data);
        }
        await sendMessage({ body: `📅 קבעתי לנו: ${row.title}, ${whenText(row)}${firstNote ? '\n📝 ' + firstNote : ''}` });
      }
      closeSheet(); toast(date ? 'נשמר' : 'הדייט נקבע ♥');
      const { data } = await sb.from('dates').select('*').order('date_on').order('time_at', { nullsFirst: false });
      S.dates = data || []; render();
    });
  });
}

function openAddIdea() {
  openSheet(`
    <h2>רעיון חדש</h2>
    <form id="addidea">
      <label class="field"><span>שם הרעיון</span><input name="title" required placeholder="למשל: מסעדה איטלקית ביפו"></label>
      <label class="field"><span>כמה מילים (לא חובה)</span><input name="description"></label>
      <div class="row2">
        <label class="field"><span>קטגוריה</span><select name="category">${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v.em} ${v.label}</option>`).join('')}</select></label>
        <label class="field"><span>משך</span><select name="duration">${Object.entries(DUR).map(([k, v]) => `<option value="${k}" ${k === 'evening' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>עלות משוערת (₪)</span><input name="cost" type="number" inputmode="numeric" min="0" step="10" value="300"></label>
      <div class="btns"><button class="btn" type="submit">הוספה</button><button class="btn ghost" type="button" data-close>סגירה</button></div>
    </form>`, (sheet) => {
    sheet.querySelector('#addidea').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const { data, error } = await sb.from('ideas').insert({
        title: fd.title.trim(), description: fd.description.trim() || null, category: fd.category,
        duration: fd.duration, cost: Number(fd.cost) || 0, created_by: S.me, art: DEFAULT_ART[fd.category],
      }).select().single();
      if (error) return toast('לא נשמר');
      S.ideas.push(data);
      await castVote(data.id, 1, false);
      closeSheet(); toast('הרעיון נוסף, וסימנת שאהבת ♥');
    });
  });
}

function openSettings() {
  openSheet(`
    <h2>הגדרות</h2>
    <p class="muted" style="margin-top:-6px">מחובר/ת כ${esc(nameOf(S.me))}</p>
    <div class="btns">
      <button class="btn ghost" data-switch>החלפה ל${esc(nameOf(partner()))}</button>
      <button class="btn ghost" data-logout>יציאה מהאפליקציה</button>
      <button class="btn" data-close>סגירה</button>
    </div>`, (sheet) => {
    sheet.querySelector('[data-switch]').addEventListener('click', () => {
      S.me = partner(); lsSet('dates-profile', S.me); closeSheet(); computeUnread(); render();
    });
    sheet.querySelector('[data-logout]').addEventListener('click', async () => {
      await sb.auth.signOut(); lsDel('dates-profile'); S.me = null; closeSheet(); renderLogin();
    });
  });
}

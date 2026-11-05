import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, COUPLE_EMAIL, PROFILES, VAPID_PUBLIC } from './config.js';
import { sceneHtml, DEFAULT_ART } from './scenes.js';
import { makeMovie, pickMime } from './movie.js';

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
  memories: [],
  movies: [],
  settings: {},
  urls: {},       // storage path -> signed url
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
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  album: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="4"/><circle cx="12" cy="12.5" r="3.6"/><path d="M8 5l1.4-2h5.2L16 5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6a3.5 3.5 0 0 1-3.5 3.5H10l-4.5 4v-4.2A3.5 3.5 0 0 1 4 12.5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
};
const COUPLE = 'icons/couple.svg';
const FEEL = {
  perfect: { em: '😍', label: 'היה מושלם' },
  enjoyed: { em: '🥰', label: 'נהנינו' },
  nice:    { em: '🙂', label: 'היה נחמד' },
  meh:     { em: '😕', label: 'לא משהו' },
};
const FREQ = { date: 'אחרי כל דייט', day: 'כל יום', week: 'כל שבוע', month: 'כל חודש' };
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
  syncPush();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAll().then(render); });
}

async function loadAll() {
  const [ideas, votes, dates, msgs, notes, mems, movies, settings] = await Promise.all([
    sb.from('ideas').select('*').order('id'),
    sb.from('votes').select('*'),
    sb.from('dates').select('*').order('date_on').order('time_at', { nullsFirst: false }),
    sb.from('messages').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('date_notes').select('*').order('created_at'),
    sb.from('memories').select('*').order('taken_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('movies').select('*').order('created_at', { ascending: false }),
    sb.from('settings').select('*'),
  ]);
  if (ideas.error?.status === 401 || ideas.error?.code === 'PGRST301') { await sb.auth.signOut(); return renderLogin(); }
  S.ideas = ideas.data || [];
  S.votes = votes.data || [];
  S.dates = dates.data || [];
  S.messages = (msgs.data || []).sort((a, b) => a.created_at.localeCompare(b.created_at));
  S.notes = notes.data || [];
  S.memories = mems.data || [];
  S.movies = movies.data || [];
  S.settings = Object.fromEntries((settings.data || []).map((r) => [r.key, r.value]));
  computeUnread();
}

function subscribe() {
  if (S.channel) sb.removeChannel(S.channel);
  S.channel = sb.channel('couple')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => {
      if (p.eventType === 'INSERT') {
        if (!S.messages.some((m) => m.id === p.new.id)) S.messages.push(p.new);
        if (p.new.profile !== S.me && S.tab !== 'chat') toast(`💬 ${nameOf(p.new.profile)}: ${msgPreview(p.new)}`);
      } else if (p.eventType === 'UPDATE') {
        const i = S.messages.findIndex((m) => m.id === p.new.id); if (i >= 0) S.messages[i] = p.new;
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, async () => {
      const { data } = await sb.from('memories').select('*').order('taken_on', { ascending: false }).order('created_at', { ascending: false });
      S.memories = data || []; render(true);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, async () => {
      const { data } = await sb.from('movies').select('*').order('created_at', { ascending: false }); S.movies = data || []; render(true);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async () => {
      const { data } = await sb.from('settings').select('*'); S.settings = Object.fromEntries((data || []).map((r) => [r.key, r.value])); render(true);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, async () => {
      const { data } = await sb.from('ideas').select('*').order('id'); S.ideas = data || []; render(true);
    })
    .subscribe();
}

function computeUnread() {
  if (S.tab === 'chat') {
    const last = S.messages.reduce((a, m) => (m.id > (a?.id ?? 0) ? m : a), null);
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
      ${[['home', 'בית'], ['vote', 'הצבעה'], ['dates', 'דייטים'], ['album', 'אלבום'], ['chat', 'צ׳אט']]
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
    if (error) { input.value = body; console.error(error); return toast(`ההערה לא נשמרה (${error.code || ''} ${error.message || ''})`); }
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
  const titles = { home: 'הדייטים שלנו', vote: 'מה עושים השבוע?', dates: 'היומן שלנו', album: 'האלבום שלנו', chat: `צ׳אט עם ${nameOf(partner())}` };
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
  if (soft && (S.busy || S.rec)) return; // a movie is being made / voice recording in progress
  const views = { home: viewHome, vote: viewVote, dates: viewDates, album: viewAlbum, chat: viewChat };
  const wasAtBottom = S.tab === 'chat' && (window.innerHeight + window.scrollY >= document.body.scrollHeight - 80);
  $('#main').innerHTML = views[S.tab]();
  if (S.tab !== 'chat') $('#composer-slot').innerHTML = '';
  else if (!$('#composer')) { $('#composer-slot').innerHTML = composerHtml(); bindComposer(); }
  else $('.quick').innerHTML = quickReplies().map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
  if (S.tab === 'chat') bindReactions();
  if (S.tab === 'vote' && S.voteMode === 'random') bindSwipe();
  hydrateMedia();
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

  if (pushState() === 'off' || pushState() === 'ios-install') {
    html += `<div class="card notif-ask"><span class="bell">🔔</span><div><b>להפעיל התראות?</b>
      <p class="muted small" style="margin:2px 0 10px">תזכורת בבוקר הדייט, הודעות מ${esc(nameOf(partner()))} וסרטון השבוע, גם כשהאפליקציה סגורה.</p>
      <button class="btn small violet" data-act="push-on">הפעלה</button></div></div>`;
  }

  for (const d of awaitingFeedback()) {
    html += `<div class="card ask">
      <b>איך היה ${esc(d.title)}?</b>
      <p class="muted small" style="margin:2px 0 10px">${esc(fmtDate(d.date_on))}${d.place ? ', ' + esc(d.place) : ''}</p>
      <div class="feel-row">${Object.entries(FEEL).map(([k, f]) => `<button data-act="feel" data-id="${d.id}" data-f="${k}"><span>${f.em}</span>${f.label}</button>`).join('')}</div>
      <button class="linkish small" data-act="feel" data-id="${d.id}" data-f="skip">לא יצא לנו</button>
    </div>`;
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

  const mem = memoryOfTheDay();
  if (mem) {
    const d = S.dates.find((x) => x.id === mem.date_id);
    html += `<h3 class="section-title">זוכרים? 💭</h3>
    <button class="memory-hero" data-act="view-mem" data-id="${mem.id}">
      ${mediaTag(mem, 'cover')}
      <span class="cap"><b>${esc(d?.title || mem.caption || 'רגע שלנו')}</b><span>${esc(agoText(mem.taken_on))}${d?.place ? ', ' + esc(d.place) : ''}</span></span>
    </button>`;
  }

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
      ${d.feeling ? `<div class="feel-chip">${FEEL[d.feeling].em} ${FEEL[d.feeling].label}</div>` : ''}
      ${memStrip(d)}
      <div class="muted small" style="margin-top:6px">${esc(nameOf(d.created_by))} קבע/ה${status}</div>
      <div class="acts">
        <button class="btn small ghost" data-act="edit-date" data-id="${d.id}">עריכה</button>
        ${d.status === 'planned' ? `<button class="btn small ghost" data-act="done-date" data-id="${d.id}">✓ היה</button>` : ''}
        ${d.status !== 'cancelled' ? `<button class="btn small ghost" data-act="add-mem" data-id="${d.id}">📷 תמונות</button>` : ''}
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

const REACTS = ['❤️', '😍', '😂', '👍', '🥺', '🔥'];
const msgPreview = (m) => m.body || ({ image: '📷 תמונה', video: '🎥 סרטון', audio: '🎤 הודעה קולית' }[m.media_kind] || 'שלח/ה רעיון');

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
    const media = !m.media_path ? '' : m.media_kind === 'image'
      ? `<button class="msg-media" data-act="chat-img" data-path="${esc(m.media_path)}"><img data-path="${esc(m.media_path)}" alt=""></button>`
      : m.media_kind === 'video'
        ? `<div class="msg-media"><video data-path="${esc(m.media_path)}" controls playsinline preload="metadata"></video></div>`
        : `<div class="msg-audio"><audio data-path="${esc(m.media_path)}" controls preload="metadata"></audio></div>`;
    const rx = Object.entries(m.reactions || {}).filter(([, e]) => e);
    html += `<div class="msg ${m.profile === S.me ? 'me' : 'them'} ${m.media_path && !m.body ? 'has-media' : ''}" data-mid="${m.id}">${media}${m.body ? `<span class="body">${esc(m.body)}</span>` : ''}${idea ? `
      <div class="attached cat-${idea.category}"><div class="strip">${sceneHtml(idea)}</div><div class="in">
        <b>${esc(idea.title)}</b><span class="small muted">${DUR[idea.duration] ?? ''}, כ-${idea.cost} ₪</span>
        <div><button data-act="schedule" data-id="${idea.id}">📅 קבעו דייט</button>${voteOf(idea.id, S.me) !== 1 ? `<button data-act="vote-id" data-id="${idea.id}" data-v="1">♥ אהבתי</button>` : ''}</div>
      </div></div>` : ''}<span class="meta">${time}</span>${rx.length ? `<span class="rx">${rx.map(([p, e]) => `<span title="${nameOf(p)}">${e}</span>`).join('')}</span>` : ''}</div>`;
  }
  return html + '</div>';
}

// quick replies that fit what the partner last sent
function quickReplies() {
  const toHer = partner() === 'eilat';
  const g = (m, f) => (toHer ? f : m);
  const lastTheirs = [...S.messages].reverse().find((m) => m.profile !== S.me);
  const lastAny = S.messages.at(-1);
  if (lastTheirs && lastAny === lastTheirs) {
    if (lastTheirs.idea_id) return ['אהבתי! 😍', g('בוא נקבע 📅', 'בואי נקבע 📅'), 'אולי משהו אחר?', 'מתי?'];
    if ((lastTheirs.body || '').startsWith('📅')) return ['מושלם, נתראה שם ❤️', 'אני אסדר בייביסיטר', 'אפשר שעה אחרת?', 'כבר מחכה 🥰'];
    if (lastTheirs.media_path || (lastTheirs.body || '').startsWith('📷')) return ['איזה יפה 😍', 'איזה ערב היה ❤️', 'עוד! 📸'];
    if ((lastTheirs.body || '').startsWith('🎬')) return ['בוכה 🥺❤️', 'הכי יפה שיש', 'עוד אחד כזה!'];
    if ((lastTheirs.body || '').includes('?')) return ['כן! 😍', 'לא בטוח/ה', 'בוא/י נדבר', 'תני לי לחשוב'].map((x) => x.replace('בוא/י', g('בוא', 'בואי')).replace('תני', g('תן', 'תני')).replace('בטוח/ה', S.me === 'eilat' ? 'בטוחה' : 'בטוח'));
  }
  return [g('אוהבת אותך ❤️', 'אוהב אותך ❤️'), g('מתגעגעת 🥰', 'מתגעגע 🥰'), 'מה בא לך השבוע?', g('יש לי רעיון 💡', 'יש לי רעיון 💡')];
}

function composerHtml() {
  return `<div class="composer-wrap">
    <div class="quick">${quickReplies().map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="composer" id="composer">
      <button type="button" class="attach" data-act-c="attach" aria-label="שליחת רעיון">🎲</button>
      <button type="button" class="attach photo" data-act-c="photo" aria-label="שליחת תמונה">📷</button>
      <div class="rec-bar" hidden><span class="dot"></span><span class="rec-time">0:00</span><button type="button" class="rec-cancel">ביטול</button></div>
      <textarea id="msg" rows="1" placeholder="מה בא לך השבוע?"></textarea>
      <button class="send mic" type="submit" aria-label="הודעה קולית">${ICON.mic}</button>
    </form>
  </div>`;
}

function bindComposer() {
  const f = $('#composer'); const ta = $('#msg'); const btn = f.querySelector('.send');
  const recBar = f.querySelector('.rec-bar');
  const setBtn = () => {
    const hasText = ta.value.trim().length > 0;
    btn.classList.toggle('mic', !hasText && !S.rec);
    btn.innerHTML = hasText || S.rec ? ICON.send : ICON.mic;
    btn.setAttribute('aria-label', hasText ? 'שליחה' : S.rec ? 'שליחת ההקלטה' : 'הודעה קולית');
  };
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; setBtn(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (S.rec) return stopRecording(true);
    const body = ta.value.trim();
    if (!body) return startRecording(f, recBar, setBtn);
    ta.value = ''; ta.style.height = ''; setBtn();
    await sendMessage({ body });
  });
  f.querySelector('.rec-cancel').addEventListener('click', () => stopRecording(false));
  f.querySelector('[data-act-c="attach"]').addEventListener('click', () => {
    const pool = S.ideas.filter((i) => voteOf(i.id, S.me) !== -1);
    const idea = pool[Math.floor(Math.random() * pool.length)];
    if (idea) sendMessage({ body: 'מה דעתך על זה? 🎲', idea_id: idea.id });
  });
  f.querySelector('[data-act-c="photo"]').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*,video/*'; input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => { const file = input.files[0]; input.remove(); if (file) await sendMedia(file); });
    input.click();
  });
  $('.quick').addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]'); if (q) sendMessage({ body: q.dataset.q });
  });
  setBtn();
}

async function sendMedia(file) {
  const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
  if (kind === 'video' && file.size > 50 * 1024 * 1024) return toast('הסרטון גדול מדי. צלמו קטע קצר');
  toast('שולח…');
  const body = kind === 'image' ? await resizeImage(file) : file;
  const ext = kind === 'image' ? 'jpg' : (file.name?.split('.').pop() || (kind === 'audio' ? 'm4a' : 'mp4')).toLowerCase();
  const path = `chat/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, body, { contentType: kind === 'image' ? 'image/jpeg' : file.type });
  if (up.error) return toast('השליחה נכשלה');
  await sendMessage({ body: null, media_path: path, media_kind: kind });
}

// ---------- voice messages ----------
async function startRecording(f, recBar, setBtn) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return toast('צריך לאשר גישה למיקרופון'); }
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const t0 = Date.now();
  S.rec = { rec, stream, chunks, mime: (mime || 'audio/webm').split(';')[0], keep: true, recBar, setBtn,
    timer: setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      recBar.querySelector('.rec-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (s >= 120) stopRecording(true);
    }, 300) };
  rec.onstop = async () => {
    const r = S.rec; S.rec = null;
    clearInterval(r.timer); r.stream.getTracks().forEach((t) => t.stop());
    r.recBar.hidden = true; $('#msg') && ($('#msg').hidden = false); r.setBtn();
    if (!r.keep || !r.chunks.length) return;
    const ext = r.mime.includes('mp4') ? 'm4a' : 'webm';
    await sendMedia(new File(r.chunks, `voice.${ext}`, { type: r.mime }));
  };
  rec.start();
  recBar.hidden = false; $('#msg').hidden = true; setBtn();
}
function stopRecording(keep) {
  if (!S.rec) return;
  S.rec.keep = keep;
  S.rec.rec.stop();
}

// ---------- reactions: long-press or double-tap a message ----------
function bindReactions() {
  const chat = $('.chat'); if (!chat || chat.dataset.bound) return;
  chat.dataset.bound = '1';
  let timer = null;
  chat.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.msg'); if (!el || e.target.closest('button, video, audio')) return;
    timer = setTimeout(() => openReactions(Number(el.dataset.mid)), 450);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((ev) => chat.addEventListener(ev, (e) => {
    if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
    clearTimeout(timer);
  }));
  chat.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.msg'); if (el) react(Number(el.dataset.mid), '❤️');
  });
  chat.addEventListener('contextmenu', (e) => { if (e.target.closest('.msg')) e.preventDefault(); });
}
function openReactions(id) {
  navigator.vibrate?.(15);
  openSheet(`<h2>תגובה</h2><div class="react-row">${REACTS.map((r) => `<button data-r="${r}">${r}</button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" data-close>סגירה</button></div>`, (sheet) => {
    sheet.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { closeSheet(); react(id, b.dataset.r); }));
  });
}
async function react(id, emoji) {
  const m = S.messages.find((x) => x.id === id); if (!m) return;
  const rx = { ...(m.reactions || {}) };
  rx[S.me] = rx[S.me] === emoji ? null : emoji; // same emoji again removes it
  if (!rx[S.me]) delete rx[S.me];
  m.reactions = rx; render();
  const { error } = await sb.from('messages').update({ reactions: rx }).eq('id', id);
  if (error) toast('התגובה לא נשמרה');
}

async function sendMessage({ body, idea_id = null, media_path = null, media_kind = null }) {
  const { data, error } = await sb.from('messages').insert({ profile: S.me, body, idea_id, media_path, media_kind }).select().single();
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
    case 'done-date': openFeedback(S.dates.find((d) => d.id === id)); break;
    case 'feel': await saveFeeling(id, b.dataset.f); break;
    case 'add-mem': pickMedia({ dateId: id, camera: false }); break;
    case 'camera': pickMedia({ dateId: S.albumDate, camera: true }); break;
    case 'gallery': pickMedia({ dateId: S.albumDate, camera: false }); break;
    case 'view-mem': openViewer(id); break;
    case 'push-on': await enablePush(); break;
    case 'chat-img': openSheet(`<div class="viewer"><img data-path="${esc(b.dataset.path)}" alt=""></div><div class="btns"><button class="btn" data-close>סגירה</button></div>`, () => hydrateMedia()); break;
    case 'freq': await setFreq(b.dataset.f); break;
    case 'make-movie': await startMovie(b.dataset.period); break;
    case 'share-movie': await shareMovie(id); break;
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
    <div class="card" style="box-shadow:none;border:2px solid var(--line)">
      <b>🔔 התראות</b>
      <p class="muted small" style="margin:2px 0 10px">${{ on: 'פעילות במכשיר הזה ✓', off: 'כבויות במכשיר הזה', denied: 'נחסמו. אפשר להפעיל מחדש בהגדרות הטלפון, תחת האפליקציה.', 'ios-install': 'באייפון ההתראות עובדות רק מהאייקון במסך הבית.', unsupported: 'המכשיר הזה לא תומך בהתראות.' }[pushState()]}</p>
      ${pushState() === 'off' || pushState() === 'ios-install' ? '<button class="btn small violet" data-push>הפעלה</button>' : pushState() === 'on' ? '<button class="btn small ghost" data-push>הפעלה מחדש במכשיר הזה</button>' : ''}
    </div>
    <div class="btns">
      <button class="btn ghost" data-switch>החלפה ל${esc(nameOf(partner()))}</button>
      <button class="btn ghost" data-logout>יציאה מהאפליקציה</button>
      <button class="btn" data-close>סגירה</button>
    </div>`, (sheet) => {
    sheet.querySelector('[data-push]')?.addEventListener('click', async () => { closeSheet(); await enablePush(); });
    sheet.querySelector('[data-switch]').addEventListener('click', () => {
      S.me = partner(); lsSet('dates-profile', S.me); closeSheet(); computeUnread(); render(); syncPush();
    });
    sheet.querySelector('[data-logout]').addEventListener('click', async () => {
      await sb.auth.signOut(); lsDel('dates-profile'); S.me = null; closeSheet(); renderLogin();
    });
  });
}

// ============================================================
// Feedback after a date
// ============================================================
function awaitingFeedback() {
  const now = new Date();
  return S.dates.filter((d) => {
    if (d.status !== 'planned') return false;
    if (d.date_on < todayStr()) return true;
    if (d.date_on === todayStr() && d.time_at) {
      const [h, m] = d.time_at.split(':').map(Number);
      return now.getHours() * 60 + now.getMinutes() > h * 60 + m + 180; // 3 hours after start
    }
    return false;
  }).slice(0, 2);
}

function openFeedback(d) {
  if (!d) return;
  openSheet(`
    <h2>איך היה ${esc(d.title)}?</h2>
    <div class="feel-row big">${Object.entries(FEEL).map(([k, f]) => `<button data-f="${k}"><span>${f.em}</span>${f.label}</button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" data-f="skip">לא יצא לנו</button><button class="btn ghost" data-close>סגירה</button></div>`, (sheet) => {
    sheet.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => saveFeeling(d.id, b.dataset.f)));
  });
}

async function saveFeeling(id, f) {
  const row = f === 'skip' ? { status: 'cancelled' } : { status: 'done', feeling: f };
  const { error } = await sb.from('dates').update(row).eq('id', id);
  if (error) return toast('לא נשמר, נסו שוב');
  const d = S.dates.find((x) => x.id === id); Object.assign(d, row);
  closeSheet(); render();
  if (f === 'skip') return toast('אין דבר, יהיו עוד הרבה 💜');
  openSheet(`
    <div class="center-ask"><div class="em-big">${FEEL[f].em}</div>
      <h2>${FEEL[f].label}!</h2>
      <p class="muted">רוצים לשמור תמונות או סרטונים מ${esc(d.title)}?</p></div>
    <div class="btns">
      <button class="btn" data-cam>📷 לצלם עכשיו</button>
      <button class="btn violet" data-gal>🖼️ לבחור מהגלריה</button>
      <button class="btn ghost" data-close>אחר כך</button>
    </div>`, (sheet) => {
    sheet.querySelector('[data-cam]').addEventListener('click', () => { closeSheet(); pickMedia({ dateId: id, camera: true }); });
    sheet.querySelector('[data-gal]').addEventListener('click', () => { closeSheet(); pickMedia({ dateId: id, camera: false }); });
  });
}

// ============================================================
// Media: signed URLs, tags, upload
// ============================================================
const BUCKET = 'memories';

async function ensureUrls(paths) {
  const now = Date.now();
  const need = [...new Set(paths)].filter((p) => p && !(S.urls[p] && S.urls[p].exp > now));
  if (!need.length) return;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
  (data || []).forEach((r) => { if (r.signedUrl) S.urls[r.path] = { url: r.signedUrl, exp: now + 50 * 60 * 1000 }; });
}
const urlOf = (p) => S.urls[p]?.url;

async function hydrateMedia() {
  const els = [...document.querySelectorAll('[data-path]')].filter((el) => !el.getAttribute('src'));
  if (!els.length) return;
  await ensureUrls(els.map((el) => el.dataset.path));
  els.forEach((el) => { const u = urlOf(el.dataset.path); if (u) el.src = u; });
}

function mediaTag(m, cls = '') {
  if (m.kind === 'image') return `<img class="${cls}" data-path="${esc(m.path)}" alt="" loading="lazy">`;
  if (m.thumb_path) return `<span class="vid ${cls}"><img class="${cls}" data-path="${esc(m.thumb_path)}" alt="" loading="lazy"><i>▶</i></span>`;
  return `<span class="vid ${cls}"><video class="${cls}" data-path="${esc(m.path)}#t=0.5" muted playsinline preload="metadata"></video><i>▶</i></span>`;
}

function memStrip(d) {
  const ms = S.memories.filter((m) => m.date_id === d.id).slice(0, 4);
  if (!ms.length) return '';
  const more = S.memories.filter((m) => m.date_id === d.id).length - ms.length;
  return `<div class="mem-strip">${ms.map((m) => `<button data-act="view-mem" data-id="${m.id}">${mediaTag(m)}</button>`).join('')}${more > 0 ? `<span class="more">+${more}</span>` : ''}</div>`;
}

function agoText(day) {
  const days = Math.round((new Date(todayStr() + 'T12:00:00') - new Date(day + 'T12:00:00')) / 864e5);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 14) return 'לפני שבוע';
  if (days < 31) return `לפני ${Math.round(days / 7)} שבועות`;
  if (days < 60) return 'לפני חודש';
  if (days < 365) return `לפני ${Math.round(days / 30)} חודשים`;
  return days < 730 ? 'לפני שנה' : `לפני ${Math.round(days / 365)} שנים`;
}

function memoryOfTheDay() {
  const old = S.memories.filter((m) => m.taken_on < todayStr(-2) && (m.kind === 'image' || m.thumb_path));
  const pool = old.length ? old : [];
  if (!pool.length) return null;
  const dayIndex = Math.floor(Date.now() / 864e5);
  return pool[dayIndex % pool.length];
}

function pickMedia({ dateId = null, camera = false }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  if (camera) input.setAttribute('capture', 'environment'); else input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => { uploadFiles([...input.files], dateId); input.remove(); });
  input.click();
}

async function resizeImage(file, max = 1920) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.86));
  } catch { return file; }
}

function videoThumb(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const fail = () => { URL.revokeObjectURL(url); resolve(null); };
    const t = setTimeout(fail, 8000);
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      clearTimeout(t);
      const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); resolve(b); }, 'image/jpeg', 0.8);
    };
    v.onerror = fail;
  });
}

async function uploadFiles(files, dateId) {
  if (!files.length) return;
  const date = S.dates.find((d) => d.id === dateId);
  const takenOn = date?.date_on && date.date_on <= todayStr() ? date.date_on : todayStr();
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const isVideo = f.type.startsWith('video');
    toast(`מעלה ${i + 1} מתוך ${files.length}…`);
    if (isVideo && f.size > 50 * 1024 * 1024) { toast('הסרטון גדול מדי. צלמו קטע קצר, עד כחצי דקה'); continue; }
    const base = `${dateId || 'free'}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const body = isVideo ? f : await resizeImage(f);
    const ext = isVideo ? (f.name.split('.').pop() || 'mp4').toLowerCase() : 'jpg';
    const path = `${base}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, body, { contentType: isVideo ? f.type || 'video/mp4' : 'image/jpeg' });
    if (up.error) { toast('ההעלאה נכשלה'); continue; }
    let thumb_path = null;
    if (isVideo) {
      const tb = await videoThumb(f);
      if (tb) {
        const tp = `${base}-thumb.jpg`;
        const tu = await sb.storage.from(BUCKET).upload(tp, tb, { contentType: 'image/jpeg' });
        if (!tu.error) thumb_path = tp;
      }
    }
    const { data, error } = await sb.from('memories').insert({
      date_id: dateId, profile: S.me, kind: isVideo ? 'video' : 'image', path, thumb_path, taken_on: takenOn,
    }).select().single();
    if (!error && data) { if (!S.memories.some((m) => m.id === data.id)) S.memories.unshift(data); ok++; }
  }
  if (ok) {
    toast(ok === 1 ? 'נשמר באלבום ♥' : `${ok} רגעים נשמרו באלבום ♥`);
    if (dateId) await sendMessage({ body: `📷 העליתי ${ok === 1 ? 'רגע' : ok + ' רגעים'} מ${date?.title || 'הדייט'}` });
  }
  render();
}

function openViewer(id) {
  const m = S.memories.find((x) => x.id === id); if (!m) return;
  const d = S.dates.find((x) => x.id === m.date_id);
  openSheet(`
    <div class="viewer">${m.kind === 'image'
      ? `<img data-path="${esc(m.path)}" alt="">`
      : `<video data-path="${esc(m.path)}" controls playsinline autoplay></video>`}</div>
    <h2 style="margin-top:12px">${esc(d?.title || 'רגע שלנו')}</h2>
    <p class="muted" style="margin-top:-8px">${esc(agoText(m.taken_on))}${d?.place ? ', ' + esc(d.place) : ''}, ${esc(nameOf(m.profile))} העלה/תה</p>
    <div class="btns">
      ${m.profile === S.me ? '<button class="btn ghost" data-del>מחיקה מהאלבום</button>' : ''}
      <button class="btn" data-close>סגירה</button>
    </div>`, async (sheet) => {
    await hydrateMedia();
    sheet.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!confirm('למחוק את הרגע הזה מהאלבום?')) return;
      await sb.storage.from(BUCKET).remove([m.path, m.thumb_path].filter(Boolean));
      await sb.from('memories').delete().eq('id', m.id);
      S.memories = S.memories.filter((x) => x.id !== m.id);
      closeSheet(); render(); toast('נמחק');
    });
  });
}

// ============================================================
// Album screen + love movies
// ============================================================
function periodKey(m, freq) {
  const day = m.taken_on;
  if (freq === 'date') return m.date_id ? `date-${m.date_id}` : `day-${day}`;
  if (freq === 'day') return `day-${day}`;
  if (freq === 'month') return `month-${day.slice(0, 7)}`;
  const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); // week starts Sunday
  return `week-${d.toLocaleDateString('en-CA')}`;
}
function periodTitle(key) {
  const [type, ...rest] = key.split('-'); const v = rest.join('-');
  const dm = (s) => { const d = new Date(s + 'T12:00:00'); return `${d.getDate()}.${d.getMonth() + 1}`; };
  if (type === 'date') { const d = S.dates.find((x) => x.id === Number(v)); return d ? d.title : 'הדייט שלנו'; }
  if (type === 'day') return `היום שלנו, ${dm(v)}`;
  if (type === 'week') return `השבוע שלנו, מ-${dm(v)}`;
  if (type === 'month') return new Date(v + '-15T12:00:00').toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  return key;
}
function periods() {
  const freq = S.settings.movie_freq || 'week';
  const map = new Map();
  for (const m of S.memories) {
    const k = periodKey(m, freq);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items }));
}

function viewAlbum() {
  const recentDates = S.dates.filter((d) => d.status !== 'cancelled' && d.date_on <= todayStr(1)).slice(-8).reverse();
  if (S.albumDate === undefined) S.albumDate = recentDates[0]?.id ?? null;
  const freq = S.settings.movie_freq || 'week';
  const canMake = !!pickMime();

  let html = `<div class="shoot">
    <button class="shoot-btn cam" data-act="camera"><span class="ic">📷</span><b>לצלם</b><span>תמונה או סרטון</span></button>
    <button class="shoot-btn gal" data-act="gallery"><span class="ic">🖼️</span><b>מהגלריה</b><span>כמה שרוצים</span></button>
  </div>
  <label class="field attach-to"><span>הרגעים יישמרו תחת</span>
    <select data-album-date>
      <option value="">בלי דייט מסוים</option>
      ${recentDates.map((d) => `<option value="${d.id}" ${S.albumDate === d.id ? 'selected' : ''}>${esc(d.title)}, ${esc(fmtDate(d.date_on))}</option>`).join('')}
    </select>
  </label>`;

  html += `<h3 class="section-title">סרטוני אהבה 🎬</h3>
  <div class="freq">${Object.entries(FREQ).map(([k, l]) => `<button data-act="freq" data-f="${k}" class="${freq === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;

  const ps = periods().slice(0, 6);
  if (!ps.length) {
    html += `<div class="empty small"><span class="ic">🎞️</span>אחרי שתעלו תמונות, ניצור מהן סרטון עם מוזיקה רומנטית.</div>`;
  }
  for (const p of ps) {
    const movie = S.movies.find((mv) => mv.period === p.key);
    if (movie) {
      html += `<div class="movie-card">
        <video data-path="${esc(movie.path)}" controls playsinline preload="metadata"></video>
        <div class="row"><b>${esc(movie.title)}</b><button class="btn small ghost" data-act="share-movie" data-id="${movie.id}">שמירה ושיתוף</button></div>
      </div>`;
    } else {
      const cover = p.items.find((m) => m.kind === 'image' || m.thumb_path);
      html += `<div class="movie-todo">
        <div class="thumb">${cover ? mediaTag(cover) : '🎞️'}</div>
        <div class="txt"><b>${esc(periodTitle(p.key))}</b><span class="muted small">${p.items.length} רגעים מחכים לסרטון</span></div>
        ${canMake ? `<button class="btn small" data-act="make-movie" data-period="${esc(p.key)}">✨ ליצור</button>` : '<span class="muted small">לא נתמך במכשיר</span>'}
      </div>`;
    }
  }

  html += `<h3 class="section-title">הרגעים שלנו</h3>`;
  if (!S.memories.length) {
    html += `<div class="empty"><span class="ic">📸</span>עוד אין כאן רגעים. צלמו משהו בדייט הבא!</div>`;
  } else {
    const groups = new Map();
    for (const m of S.memories) {
      const k = m.date_id ? `d${m.date_id}` : `t${m.taken_on}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    for (const [k, ms] of groups) {
      const d = k[0] === 'd' ? S.dates.find((x) => x.id === Number(k.slice(1))) : null;
      html += `<div class="mem-group"><div class="mem-head"><b>${esc(d?.title || 'רגעים')}</b><span class="muted small">${esc(fmtDate(d?.date_on || ms[0].taken_on))}${d?.feeling ? ' ' + FEEL[d.feeling].em : ''}</span></div>
        <div class="mem-grid">${ms.map((m) => `<button data-act="view-mem" data-id="${m.id}">${mediaTag(m)}</button>`).join('')}</div></div>`;
    }
  }
  return html;
}

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-album-date]'); if (!sel) return;
  S.albumDate = sel.value ? Number(sel.value) : null;
});

async function setFreq(f) {
  S.settings.movie_freq = f; render();
  await sb.from('settings').upsert({ key: 'movie_freq', value: f });
}

async function startMovie(key) {
  const p = periods().find((x) => x.key === key); if (!p) return;
  const items = [...p.items].sort((a, b) => (a.taken_on + a.created_at).localeCompare(b.taken_on + b.created_at)).slice(0, 20);
  S.busy = true;
  openSheet(`
    <h2>יוצרים לכם סרטון ✨</h2>
    <p class="muted" style="margin-top:-8px">השאירו את המסך פתוח, זה לוקח בערך דקה. המוזיקה תתנגן בזמן היצירה.</p>
    <div class="movie-preview"><canvas id="movie-canvas"></canvas></div>
    <div class="progress"><span id="movie-prog"></span></div>`, () => {});
  try {
    await ensureUrls(items.map((m) => m.path));
    const local = [];
    for (const m of items) {
      try {
        const r = await fetch(urlOf(m.path)); const b = await r.blob();
        const d = S.dates.find((x) => x.id === m.date_id);
        local.push({
          url: URL.createObjectURL(b), kind: m.kind,
          line1: d?.title || m.caption || '',
          line2: [fmtDate(d?.date_on || m.taken_on), d?.place].filter(Boolean).join(', '),
        });
      } catch {}
    }
    const title = periodTitle(key);
    const { blob, mime } = await makeMovie(local, {
      title, subtitle: 'טל ואילת', coupleUrl: COUPLE, canvas: $('#movie-canvas'),
      onProgress: (x) => { const el = $('#movie-prog'); if (el) el.style.width = Math.round(x * 100) + '%'; },
    });
    local.forEach((l) => URL.revokeObjectURL(l.url));
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const path = `movies/${key}-${Date.now()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: mime });
    if (up.error) throw up.error;
    const { data } = await sb.from('movies').insert({ period: key, title, path, mime, profile: S.me }).select().single();
    if (data) S.movies.unshift(data);
    await sendMessage({ body: `🎬 הסרטון "${title}" מוכן באלבום ♥` });
    S.busy = false; closeSheet(); render(); toast('הסרטון מוכן ♥');
  } catch (err) {
    S.busy = false; closeSheet(); render();
    toast(String(err?.message) === 'no-recorder' ? 'המכשיר הזה לא תומך ביצירת סרטון' : 'יצירת הסרטון נכשלה, נסו שוב');
  }
}

async function shareMovie(id) {
  const mv = S.movies.find((x) => x.id === id); if (!mv) return;
  await ensureUrls([mv.path]);
  const url = urlOf(mv.path);
  try {
    const b = await (await fetch(url)).blob();
    const file = new File([b], `${mv.title}.${mv.path.split('.').pop()}`, { type: mv.mime || b.type });
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: mv.title });
  } catch (e) { if (e?.name === 'AbortError') return; }
  window.open(url, '_blank');
}


// ============================================================
// Push notifications
// ============================================================
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function pushState() {
  if (isIOS && !isStandalone) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && lsGet('dates-push') === '1') return 'on';
  return 'off';
}

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function saveSubscription(sub) {
  const j = sub.toJSON();
  const { error } = await sb.from('push_subscriptions')
    .upsert({ profile: S.me, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
  return !error;
}

async function enablePush() {
  const st = pushState();
  if (st === 'ios-install') {
    return openSheet(`
      <h2>התראות באייפון</h2>
      <ol class="steps">
        <li>פותחים את האפליקציה ב<b>ספארי</b>.</li>
        <li>לוחצים על כפתור השיתוף <b>⬆️</b> בתחתית המסך.</li>
        <li>בוחרים <b>הוספה למסך הבית</b>, ואז <b>הוסף</b>.</li>
        <li>פותחים את האפליקציה מהאייקון החדש ולוחצים שוב על <b>הפעלת התראות</b>.</li>
      </ol>
      <div class="btns"><button class="btn" data-close>הבנתי</button></div>`);
  }
  if (st === 'unsupported') return toast('המכשיר הזה לא תומך בהתראות');
  if (st === 'denied') return toast('ההתראות חסומות. אפשר להפעיל בהגדרות הטלפון');
  lsDel('dates-push');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return toast('בלי אישור לא נוכל לשלוח תזכורות');
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) }));
    if (!(await saveSubscription(sub))) throw new Error('save');
    lsSet('dates-push', '1');
    toast('🔔 ההתראות הופעלו');
    render();
  } catch {
    toast('ההפעלה לא הצליחה, נסו שוב');
  }
}

// make sure this device's subscription belongs to whoever is using it now
async function syncPush() {
  if (pushState() !== 'on') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await saveSubscription(sub); else lsDel('dates-push');
  } catch {}
}

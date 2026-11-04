// ============================================================
// notify — sends push notifications to טל and אילת.
// Called by database triggers (new message, match, note) and
// by an hourly schedule (date-day morning, "how was it",
// weekly "what are we doing", love-movie reminders).
// Paste this whole file into a Supabase Edge Function named "notify".
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type P = 'tal' | 'eilat';
const NAME: Record<P, string> = { tal: 'טל', eilat: 'אילת' };
const PARTNER: Record<P, P> = { tal: 'eilat', eilat: 'tal' };
const BOTH: P[] = ['tal', 'eilat'];
const verb = (p: P, m: string, f: string) => (p === 'eilat' ? f : m);

async function secrets() {
  const { data } = await sb.from('app_secrets').select('key, value');
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}

// run something only once (protects against duplicates)
async function once(key: string) {
  const { error } = await sb.from('notify_log').insert({ key });
  return !error;
}

const report: unknown[] = []; // what happened to each push, returned to the caller

async function send(to: P[], msg: { title: string; body: string; url?: string; tag?: string }) {
  const { data: subs, error } = await sb.from('push_subscriptions').select('*').in('profile', to);
  if (error) report.push({ db_error: error.message });
  await Promise.all((subs || []).map(async (s) => {
    const host = new URL(s.endpoint).host;
    try {
      const r = await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg),
        { TTL: 6 * 3600, urgency: 'high' },
      );
      report.push({ to: s.profile, host, status: r.statusCode });
    } catch (e) {
      const err = e as { statusCode?: number; body?: string; message?: string };
      report.push({ to: s.profile, host, status: err.statusCode ?? 'error', detail: (err.body || err.message || '').slice(0, 160) });
      console.error('push failed', s.profile, host, err.statusCode, err.body || err.message);
      if (err.statusCode === 404 || err.statusCode === 410) await sb.from('push_subscriptions').delete().eq('id', s.id);
    }
  }));
}

// ---------- Israel clock ----------
function israelNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  return { today, hour: Number(parts.hour) % 24, weekday: parts.weekday as string };
}
function addDays(day: string, n: number) {
  const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

// ---------- events from the database ----------
async function onEvent(table: string, op: string, r: Record<string, unknown>) {
  if (table === 'messages' && op === 'INSERT') {
    const from = r.profile as P;
    const preview = (r.body as string) ||
      ({ image: '📷 תמונה', video: '🎥 סרטון', audio: '🎤 הודעה קולית' } as Record<string, string>)[r.media_kind as string] ||
      verb(from, 'שלח רעיון לדייט 🎲', 'שלחה רעיון לדייט 🎲');
    return send([PARTNER[from]], { title: `💬 ${NAME[from]}`, body: preview, url: './?tab=chat', tag: 'chat' });
  }

  if (table === 'votes' && r.value === 1) {
    const other = PARTNER[r.profile as P];
    const { data: v } = await sb.from('votes').select('value').eq('idea_id', r.idea_id).eq('profile', other).maybeSingle();
    if (v?.value !== 1) return;
    if (!(await once(`match-${r.idea_id}`))) return;
    const { data: idea } = await sb.from('ideas').select('title').eq('id', r.idea_id).single();
    return send(BOTH, { title: '💞 יש לכם התאמה!', body: `שניכם אהבתם: ${idea?.title}. בואו נקבע מתי`, url: './?tab=vote', tag: 'match' });
  }

  if (table === 'date_notes' && op === 'INSERT') {
    const from = r.profile as P;
    const { data: d } = await sb.from('dates').select('title').eq('id', r.date_id).single();
    return send([PARTNER[from]], {
      title: `📝 ${NAME[from]} ${verb(from, 'הוסיף', 'הוסיפה')} הערה`,
      body: `${d?.title ?? 'לדייט'}: ${r.body}`, url: './', tag: `note-${r.date_id}`,
    });
  }
}

// ---------- hourly schedule ----------
function periodKey(m: { taken_on: string; date_id: number | null }, freq: string) {
  if (freq === 'date') return m.date_id ? `date-${m.date_id}` : `day-${m.taken_on}`;
  if (freq === 'day') return `day-${m.taken_on}`;
  if (freq === 'month') return `month-${m.taken_on.slice(0, 7)}`;
  const d = new Date(m.taken_on + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return `week-${d.toISOString().slice(0, 10)}`;
}

async function onCron() {
  const { today, hour, weekday } = israelNow();
  const { data: dates } = await sb.from('dates').select('*').eq('status', 'planned');

  for (const d of dates || []) {
    // morning of the date
    if (d.date_on === today && hour === 8 && (await once(`morning-${d.id}`))) {
      const { count } = await sb.from('date_notes').select('id', { count: 'exact', head: true }).eq('date_id', d.id);
      await send(BOTH, {
        title: '⏰ היום יש לכם דייט!',
        body: `${d.title}${d.time_at ? ' בשעה ' + hhmm(d.time_at) : ''}${d.place ? ', ' + d.place : ''}${count ? ` · ${count} הערות` : ''}`,
        url: './', tag: `date-${d.id}`,
      });
    }
    // two hours before
    if (d.date_on === today && d.time_at && Number(d.time_at.slice(0, 2)) - 2 === hour && (await once(`soon-${d.id}`))) {
      await send(BOTH, { title: '⏳ עוד שעתיים', body: `${d.title}${d.place ? ', ' + d.place : ''}. מתרגשים? 💜`, url: './', tag: `date-${d.id}` });
    }
    // the morning after: how was it?
    if (d.date_on < today && hour === 10 && (await once(`ask-${d.id}`))) {
      await send(BOTH, { title: `איך היה ${d.title}? 💜`, body: 'ספרו באפליקציה, ושמרו תמונות מהערב', url: './', tag: `ask-${d.id}` });
    }
  }

  // Sunday: nothing planned this week?
  if (weekday === 'Sun' && hour === 9) {
    const planned = (dates || []).some((d) => d.date_on >= today && d.date_on <= addDays(today, 6));
    if (!planned && (await once(`week-${today}`))) {
      await send(BOTH, { title: '🎲 מה עושים השבוע?', body: 'עוד לא קבעתם דייט. בואו נגריל רעיון ביחד', url: './?tab=vote', tag: 'week' });
    }
  }

  // love-movie reminders
  const { data: st } = await sb.from('settings').select('value').eq('key', 'movie_freq').maybeSingle();
  const freq = st?.value || 'week';
  const lastOfMonth = addDays(today, 1).slice(8, 10) === '01';
  const due =
    (freq === 'day' && hour === 21) ||
    (freq === 'week' && weekday === 'Sat' && hour === 20) ||
    (freq === 'month' && lastOfMonth && hour === 20) ||
    (freq === 'date' && hour === 11);
  if (due) {
    const { data: mems } = await sb.from('memories').select('taken_on, date_id').gte('taken_on', addDays(today, -40));
    const { data: movies } = await sb.from('movies').select('period');
    const made = new Set((movies || []).map((m) => m.period));
    const counts = new Map<string, number>();
    for (const m of mems || []) { const k = periodKey(m, freq); counts.set(k, (counts.get(k) || 0) + 1); }
    const current =
      freq === 'day' ? `day-${today}` :
      freq === 'week' ? periodKey({ taken_on: today, date_id: null }, 'week') :
      freq === 'month' ? `month-${today.slice(0, 7)}` : null;
    const keys = freq === 'date'
      ? [...counts.keys()].filter((k) => k.startsWith('date-'))
      : current ? [current] : [];
    for (const k of keys) {
      const n = counts.get(k) || 0;
      if (!n || made.has(k) || !(await once(`movie-${k}`))) continue;
      await send(BOTH, { title: '🎬 סרטון האהבה שלכם מחכה', body: `${n} רגעים מוכנים להפוך לסרטון עם מוזיקה. לחצו כדי ליצור`, url: './?tab=album', tag: 'movie' });
    }
  }
}

Deno.serve(async (req) => {
  const sec = await secrets();
  if (!sec.notify_secret || req.headers.get('x-notify-secret') !== sec.notify_secret) {
    return new Response('unauthorized', { status: 401 });
  }
  webpush.setVapidDetails('mailto:hello@datesapp.com', sec.vapid_public, sec.vapid_private);
  report.length = 0;
  const p = await req.json().catch(() => ({}));
  try {
    if (p.type === 'event') await onEvent(p.table, p.op, p.record || {});
    else if (p.type === 'cron') await onCron();
    else if (p.type === 'test') await send(BOTH, { title: '🔔 בדיקה', body: 'ההתראות עובדות ♥', url: './' });
    return new Response(JSON.stringify({ ok: true, type: p.type, report }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e), report }), { status: 500 });
  }
});

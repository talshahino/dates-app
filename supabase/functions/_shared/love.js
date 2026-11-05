// Shared by the app (browser) and the notifier (Supabase): love languages,
// the weekly gesture, the weekly random time slots, and quiz questions.
// Plain JavaScript so both sides can import the same file.

export const LANGS = {
  words: { em: '💬', label: 'מילים טובות' },
  time:  { em: '⏳', label: 'זמן איכות' },
  gifts: { em: '🎁', label: 'מתנות קטנות' },
  acts:  { em: '🤲', label: 'מעשים' },
  touch: { em: '🤗', label: 'מגע' },
};
export const NAMES = { tal: 'טל', eilat: 'אילת' };
export const PARTNER = { tal: 'eilat', eilat: 'tal' };
const isF = (p) => p === 'eilat';

// ---------- deterministic randomness (same answer in the app and on the server) ----------
function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
export function seeded(key) { return hash(key); }

// week key = the Sunday (Israel) that starts the week, YYYY-MM-DD
export function weekKeyOf(dayStr) {
  const d = new Date(dayStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

// one random moment per week: any day except Friday, between 9:00 and 20:00
export function weeklySlot(weekKey, salt) {
  const r = seeded(`${weekKey}|${salt}`);
  const days = [0, 1, 2, 3, 4, 6]; // Sun..Thu, Sat
  return { dow: days[Math.floor(r() * days.length)], hour: 9 + Math.floor(r() * 12) }; // 9..20
}

// ---------- weekly gestures ----------
// each item: (g = by giver gender, h = by partner gender, P = partner name)
const GESTURES = {
  words: [
    (g, h, P) => `${g('שלח', 'שלחי')} ל${P} הודעה עם שלושה דברים ש${g('אתה אוהב', 'את אוהבת')} ${h('בו', 'בה')}`,
    (g, h, P) => `${g('תגיד', 'תגידי')} ל${P} בקול משהו ש${g('אתה מעריך', 'את מעריכה')} ${h('אצלו', 'אצלה')}, בלי סיבה מיוחדת`,
    (g, h, P) => `${g('כתוב', 'כתבי')} ל${P} פתק קטן ${g('והשאר', 'והשאירי')} אותו במקום ש${h('ימצא', 'תמצא')}`,
    (g, h, P) => `${g('ספר', 'ספרי')} ל${P} על רגע ש${g('היית גאה', 'היית גאה')} ${h('בו', 'בה')} לאחרונה`,
    (g, h, P) => `${g('שלח', 'שלחי')} ל${P} הקלטה קולית קצרה: "${g('אני חושב', 'אני חושבת')} ${h('עליך', 'עלייך')}"`,
    (g, h, P) => `${g('הודה', 'הודי')} ל${P} על משהו קטן ${h('שהוא עשה', 'שהיא עשתה')} השבוע`,
  ],
  time: [
    (g, h, P) => `ערב אחד בלי טלפונים, רק ${g('אתה', 'את')} ו${P}, עם תה וזמן לדבר`,
    (g, h, P) => `הליכה של חצי שעה ביחד. ${g('תשאל', 'תשאלי')} את ${P} מה הכי העסיק ${h('אותו', 'אותה')} השבוע`,
    (g, h, P) => `ארוחת בוקר ביחד בבית, בלי למהר לשום מקום`,
    (g, h, P) => `${g('בחר', 'בחרי')} סדרה חדשה ותתחילו אותה ביחד`,
    (g, h, P) => `רבע שעה של קפה ביחד בבוקר, לפני שהיום מתחיל`,
    (g, h, P) => `${g('הקשב', 'הקשיבי')} ל${P} חצי שעה בלי לתקן ובלי לייעץ, רק להקשיב`,
  ],
  gifts: [
    (g, h, P) => `${g('הבא', 'הביאי')} ל${P} את הקינוח או החטיף ${h('שהוא אוהב', 'שהיא אוהבת')}`,
    (g, h, P) => `פרחים ל${P}, סתם כי זה יום רגיל`,
    (g, h, P) => `${g('הזמן', 'הזמיני')} ל${P} משהו קטן ${h('שהוא הזכיר', 'שהיא הזכירה')} לאחרונה`,
    (g, h, P) => `${g('הדפס', 'הדפיסי')} תמונה משותפת שלכם ${g('ותן', 'ותני')} ל${P} במסגרת`,
    (g, h, P) => `${g('קנה', 'קני')} ל${P} ספר או מגזין שנראה לך ${h('שיאהב', 'שתאהב')}`,
  ],
  acts: [
    (g, h, P) => `${g('קח', 'קחי')} על עצמך השבוע משימה ש${P} לא ${h('אוהב', 'אוהבת')} לעשות`,
    (g, h, P) => `${g('הכן', 'הכיני')} ל${P} ארוחה ${h('שהוא אוהב', 'שהיא אוהבת')}, בלי ש${h('יבקש', 'תבקש')}`,
    (g, h, P) => `${g('שאל', 'שאלי')} את ${P}: "מה ${g('אני יכול', 'אני יכולה')} לעשות כדי להקל ${h('עליך', 'עלייך')} השבוע?", ${g('ותעשה', 'ותעשי')} את זה`,
    (g, h, P) => `${g('סדר', 'סדרי')} את המטבח או את הסלון לפני ש${P} ${h('חוזר', 'חוזרת')} הביתה`,
    (g, h, P) => `${g('הכן', 'הכיני')} ל${P} קפה בבוקר ${g('והבא', 'והביאי')} ${h('לו', 'לה')} עד המיטה`,
  ],
  touch: [
    (g, h, P) => `חיבוק ארוך של 20 שניות כש${P} ${h('חוזר', 'חוזרת')} הביתה`,
    (g, h, P) => `${g('הצע', 'הציעי')} ל${P} עיסוי כתפיים של עשר דקות`,
    (g, h, P) => `ללכת יד ביד בהליכה הבאה שלכם`,
    (g, h, P) => `ערב על הספה צמודים, עם שמיכה וסרט`,
    (g, h, P) => `נשיקה לפני שיוצאים מהבית, כל יום השבוע`,
  ],
};

// partnerScores: {words:0..4, ...} from the partner's quiz (or null)
export function weeklyGesture(weekKey, giver, partnerScores, shuffle = 0) {
  const partner = PARTNER[giver];
  const r = seeded(`${weekKey}|gesture|${giver}|${shuffle}`);
  const keys = Object.keys(LANGS);
  const weights = keys.map((k) => { const s = (partnerScores?.[k] ?? 2) + 1; return s * s; });
  let x = r() * weights.reduce((a, b) => a + b, 0), lang = keys[0];
  for (let i = 0; i < keys.length; i++) { x -= weights[i]; if (x <= 0) { lang = keys[i]; break; } }
  const list = GESTURES[lang];
  const make = list[Math.floor(r() * list.length)];
  const g = (m, f) => (isF(giver) ? f : m);
  const h = (m, f) => (isF(partner) ? f : m);
  return { lang, text: make(g, h, NAMES[partner]) };
}

// ---------- quiz: 10 pairs, every language meets every other once ----------
const PHRASES = {
  words: [
    (h, s, P) => `ש${P} ${h('אומר', 'אומרת')} לי כמה ${h('הוא מעריך', 'היא מעריכה')} אותי`,
    (h, s, P) => `לקבל מ${P} הודעה מתוקה באמצע היום`,
    (h, s, P) => `ש${P} ${h('מפרגן', 'מפרגנת')} לי על משהו שעשיתי`,
    (h, s, P) => `לשמוע מ${P} "אני גאה בך"`,
  ],
  time: [
    (h, s, P) => `ערב שלם עם ${P}, בלי טלפונים`,
    (h, s, P) => `ש${P} ${h('מקשיב', 'מקשיבה')} לי באמת, עם כל תשומת הלב`,
    (h, s, P) => `הליכה ושיחה ארוכה עם ${P}`,
    (h, s, P) => `ש${P} ${h('מפנה', 'מפנה')} זמן רק בשבילי`,
  ],
  gifts: [
    (h, s, P) => `ש${P} ${h('מביא', 'מביאה')} לי משהו קטן ${h('שחשב', 'שחשבה')} עליי`,
    (h, s, P) => `לקבל מ${P} הפתעה קטנה בלי סיבה`,
    (h, s, P) => `מתנה שמראה ש${P} ${h('זוכר', 'זוכרת')} מה אני ${s('אוהב', 'אוהבת')}`,
    (h, s, P) => `פרחים או קינוח אהוב מ${P}, סתם ככה`,
  ],
  acts: [
    (h, s, P) => `ש${P} ${h('לוקח', 'לוקחת')} ממני משימה בלי שביקשתי`,
    (h, s, P) => `ש${P} ${h('מכין', 'מכינה')} לי ארוחה או קפה`,
    (h, s, P) => `ש${P} ${h('עוזר', 'עוזרת')} לי כשאני ${s('עמוס', 'עמוסה')}`,
    (h, s, P) => `ש${P} ${h('מסדר', 'מסדרת')} משהו בבית בשבילי`,
  ],
  touch: [
    (h, s, P) => `חיבוק ארוך מ${P}`,
    (h, s, P) => `ללכת עם ${P} יד ביד`,
    (h, s, P) => `עיסוי או ליטוף מ${P}`,
    (h, s, P) => `להירדם צמודים ל${P}`,
  ],
};
const PAIRS = [['words', 'time'], ['gifts', 'acts'], ['touch', 'words'], ['time', 'gifts'], ['acts', 'touch'],
  ['words', 'gifts'], ['time', 'acts'], ['gifts', 'touch'], ['acts', 'words'], ['touch', 'time']];

export function quizFor(me) {
  const partner = PARTNER[me];
  const h = (m, f) => (isF(partner) ? f : m);
  const s = (m, f) => (isF(me) ? f : m);
  const used = { words: 0, time: 0, gifts: 0, acts: 0, touch: 0 };
  return PAIRS.map(([a, b]) => ({
    a: { lang: a, text: PHRASES[a][used[a]++](h, s, NAMES[partner]) },
    b: { lang: b, text: PHRASES[b][used[b]++](h, s, NAMES[partner]) },
  }));
}

// ---------- "what I need today" ----------
export function needsFor(me) {
  const s = (m, f) => (isF(me) ? f : m);
  const p = (m, f) => (isF(PARTNER[me]) ? f : m);
  return [
    { key: 'hug', em: '🤗', label: 'חיבוק', msg: `🤗 אני ${s('צריך', 'צריכה')} חיבוק` },
    { key: 'listen', em: '👂', label: 'שתקשיב/י'.replace('תקשיב/י', p('תקשיב', 'תקשיבי')), msg: `👂 אני ${s('צריך', 'צריכה')} ש${p('תקשיב', 'תקשיבי')} לי קצת` },
    { key: 'together', em: '🛋️', label: 'זמן ביחד', msg: '🛋️ בא לי זמן ביחד הערב' },
    { key: 'help', em: '🙏', label: 'עזרה', msg: `🙏 אני ${s('צריך', 'צריכה')} עזרה עם משהו` },
    { key: 'word', em: '💬', label: 'מילה טובה', msg: `💬 אני ${s('צריך', 'צריכה')} מילה טובה היום` },
  ];
}
export const NEED_PREFIXES = ['🤗 אני', '👂 אני', '🛋️ בא לי', '🙏 אני', '💬 אני'];

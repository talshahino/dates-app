-- ============================================================
-- דייטים שלנו — מבנה הנתונים (שלב 2)
-- להדביק את כל הקובץ ב-SQL Editor של Supabase וללחוץ Run
-- ============================================================

-- רעיונות לבילוי
create table if not exists public.ideas (
  id          bigint generated always as identity primary key,
  title       text not null,
  description text,
  category    text not null check (category in ('food','spa','shopping','experiences','people')),
  duration    text not null default 'evening' check (duration in ('short','evening','halfday','fullday','overnight')),
  cost        int  not null default 0,
  art         text,
  created_by  text check (created_by in ('tal','eilat')),
  created_at  timestamptz not null default now()
);

-- הצבעות: אהבתי (1) / לא אהבתי (-1)
create table if not exists public.votes (
  idea_id    bigint not null references public.ideas(id) on delete cascade,
  profile    text   not null check (profile in ('tal','eilat')),
  value      smallint not null check (value in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (idea_id, profile)
);

-- צ'אט זוגי
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  profile    text not null check (profile in ('tal','eilat')),
  body       text,
  idea_id    bigint references public.ideas(id) on delete set null,
  media_path text,
  media_kind text check (media_kind in ('image','video','audio')),
  reactions  jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- דייטים שנקבעו
create table if not exists public.dates (
  id          bigint generated always as identity primary key,
  idea_id     bigint references public.ideas(id) on delete set null,
  title       text not null,
  date_on     date not null,
  time_at     time,
  place       text,
  notes       text,
  status      text not null default 'planned' check (status in ('planned','done','cancelled')),
  surprise_by text check (surprise_by in ('tal','eilat')),
  revealed    boolean not null default false,
  rating      smallint check (rating between 1 and 5),
  feeling     text check (feeling in ('perfect','enjoyed','nice','meh')),
  created_by  text check (created_by in ('tal','eilat')),
  created_at  timestamptz not null default now()
);

-- הערות לדייט (כל אחד מכם יכול להוסיף)
create table if not exists public.date_notes (
  id         bigint generated always as identity primary key,
  date_id    bigint not null references public.dates(id) on delete cascade,
  profile    text not null check (profile in ('tal','eilat')),
  body       text not null,
  created_at timestamptz not null default now()
);

-- זיכרונות: תמונות וסרטונים מהדייטים
create table if not exists public.memories (
  id         bigint generated always as identity primary key,
  date_id    bigint references public.dates(id) on delete set null,
  profile    text not null check (profile in ('tal','eilat')),
  kind       text not null check (kind in ('image','video')),
  path       text not null,
  thumb_path text,
  caption    text,
  taken_on   date not null default current_date,
  created_at timestamptz not null default now()
);

-- סרטוני אהבה שנוצרו
create table if not exists public.movies (
  id         bigint generated always as identity primary key,
  period     text not null,          -- למשל: date-12, week-2026-11-02, month-2026-11, day-2026-11-04
  title      text not null,
  path       text not null,
  mime       text,
  profile    text check (profile in ('tal','eilat')),
  created_at timestamptz not null default now()
);

-- הגדרות משותפות (למשל: כל כמה זמן סרטון)
create table if not exists public.settings (
  key   text primary key,
  value text
);
insert into public.settings (key, value) values ('movie_freq', 'week') on conflict do nothing;

-- מנויי התראות (ישמש בשלב 3)
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  profile    text not null check (profile in ('tal','eilat')),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- הרשאות: רק מי שמחובר עם הקוד הזוגי רואה ומשנה
-- ------------------------------------------------------------
alter table public.ideas              enable row level security;
alter table public.votes              enable row level security;
alter table public.messages           enable row level security;
alter table public.dates              enable row level security;
alter table public.date_notes         enable row level security;
alter table public.memories           enable row level security;
alter table public.movies             enable row level security;
alter table public.settings           enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ideas','votes','messages','dates','date_notes','memories','movies','settings','push_subscriptions'] loop
    execute format('drop policy if exists couple_all on public.%I', t);
    execute format('create policy couple_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- עדכונים חיים (צ'אט, הצבעות, דייטים)
do $$
declare t text;
begin
  foreach t in array array['messages','votes','dates','date_notes','ideas','memories','movies','settings'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------
-- אחסון תמונות וסרטונים (פרטי, רק לשניכם)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('memories', 'memories', false, 52428800)
on conflict (id) do nothing;

drop policy if exists couple_memories on storage.objects;
create policy couple_memories on storage.objects for all to authenticated
  using (bucket_id = 'memories') with check (bucket_id = 'memories');

-- ------------------------------------------------------------
-- מאגר רעיונות התחלתי (פינוק, 500–600 ₪ לשבוע)
-- ------------------------------------------------------------
insert into public.ideas (title, description, category, duration, cost, art)
select * from (values
  ('ארוחת בוקר מפנקת', 'בית קפה שעוד לא הייתם בו, בלי למהר לשום מקום', 'food', 'short', 180, 'coffee'),
  ('בראנץ'' של שישי', 'בראנץ'' ארוך עם מימוזה ועוגה', 'food', 'short', 260, 'coffee'),
  ('קפה ומאפה בעיר אחרת', 'נוסעים לבית קפה מוכר בעיר שלא גרים בה', 'food', 'short', 150, 'coffee'),
  ('סושי בר', 'ערב יפני על הבר, מול השף', 'food', 'evening', 320, 'sushi'),
  ('אומקסה', 'השף בוחר בשבילכם מנה אחרי מנה', 'food', 'evening', 600, 'sushi'),
  ('מסעדת שף', 'ארוחה טובה באמת עם קינוח משותף', 'food', 'evening', 550, 'dinner'),
  ('ארוחת טעימות', 'תפריט טעימות של כמה מנות קטנות', 'food', 'evening', 600, 'dinner'),
  ('מסעדה עם נוף לים', 'ארוחת ערב מול הים', 'food', 'evening', 480, 'dinner'),
  ('מסעדה בגג', 'ארוחה על גג עם אורות העיר', 'food', 'evening', 450, 'dinner'),
  ('מטבח פרואני', 'סביצ''ה, פיסקו ומנות צבעוניות', 'food', 'evening', 380, 'dinner'),
  ('מטבח גאורגי', 'חצ''פורי, חינקלי ויין גאורגי', 'food', 'evening', 300, 'dinner'),
  ('מטבח אתיופי', 'אוכלים יחד מאותה אינג''רה', 'food', 'evening', 220, 'dinner'),
  ('מטבח תאילנדי', 'קארי, פאד תאי וקוקוס', 'food', 'evening', 280, 'asian'),
  ('ראמן', 'ראמן חם במסעדה קטנה', 'food', 'evening', 200, 'asian'),
  ('דים סאם', 'הרבה מנות קטנות לחלוק', 'food', 'evening', 280, 'asian'),
  ('איטלקית אמיתית', 'פסטה טרייה ויין אדום', 'food', 'evening', 380, 'pasta'),
  ('פיצה נפוליטנית', 'פיצה מתנור עצים ובירה', 'food', 'evening', 180, 'pasta'),
  ('סטייק האוס', 'נתח טוב ויין אדום', 'food', 'evening', 550, 'grill'),
  ('מסעדה מזרח תיכונית מודרנית', 'מנות לשולחן וקוקטייל', 'food', 'evening', 400, 'grill'),
  ('קינוחים בלבד', 'ערב שכולו קינוחים בפטיסרי', 'food', 'short', 160, 'dessert'),
  ('מסעדת שוק', 'אוכל של שוק במסעדה של שף', 'food', 'evening', 360, 'market'),
  ('סיור טעימות בשוק', 'שוק הכרמל, מחנה יהודה או שוק תלפיות', 'food', 'halfday', 250, 'market'),
  ('סדנת בישול זוגית', 'מבשלים יחד ואוכלים את מה שהכנתם', 'food', 'evening', 500, 'cooking'),
  ('סדנת סושי', 'לומדים לגלגל ואוכלים בסוף', 'food', 'evening', 480, 'cooking'),
  ('סדנת פסטה', 'מכינים פסטה מאפס', 'food', 'evening', 460, 'cooking'),
  ('סדנת שוקולד', 'פרלינים ושוקולד עם טעימות', 'food', 'evening', 380, 'dessert'),
  ('ערב טעימות יין', 'יקב או בר יין עם פלטת גבינות', 'food', 'evening', 380, 'wine'),
  ('סיור ביקב', 'יקב בגליל או בהרי ירושלים', 'food', 'halfday', 450, 'wine'),
  ('בר קוקטיילים', 'קוקטיילים מיוחדים בבר אינטימי', 'food', 'evening', 300, 'cocktail'),
  ('ארוחת שף בבית', 'שף פרטי מבשל לכם בבית', 'food', 'evening', 600, 'dinner'),
  ('עיסוי זוגי', 'עיסוי של שעה זה לצד זה', 'spa', 'short', 550, 'massage'),
  ('עיסוי אבנים חמות', 'עיסוי מפנק לה במיוחד', 'spa', 'short', 350, 'massage'),
  ('מתחם ספא', 'כמה שעות של בריכה, ג''קוזי וסאונה', 'spa', 'halfday', 500, 'pool'),
  ('יום פינוק במלון', 'בריכה ופינוק בלי ללון', 'spa', 'halfday', 450, 'pool'),
  ('חמי מרפא', 'טבילה במים חמים בחמת גדר או בחמי יואב', 'spa', 'halfday', 300, 'pool'),
  ('חמאם טורקי', 'חמאם, פילינג ותה', 'spa', 'halfday', 450, 'facial'),
  ('טיפול פנים', 'טיפול פנים מפנק, ואתה מחכה עם קפה', 'spa', 'short', 300, 'facial'),
  ('מניקור ופדיקור', 'פינוק ידיים ורגליים', 'spa', 'short', 200, 'nails'),
  ('ספא ביתי', 'מסכות, נרות, שמנים וארוחה מוזמנת', 'spa', 'evening', 200, 'candles'),
  ('אמבט פרחים', 'אמבטיה עם עלי ורדים ובקבוק יין', 'spa', 'evening', 150, 'candles'),
  ('יוגה זוגית', 'שיעור יוגה לזוגות ואחריו קפה', 'spa', 'short', 200, 'massage'),
  ('ספא בים המלח', 'יום ספא עם מים מלוחים ובוץ', 'spa', 'fullday', 600, 'beach'),
  ('יום קניות שלה', 'תקציב שמיועד רק לה, עם קפה באמצע', 'shopping', 'halfday', 500, 'shopping'),
  ('קניון חדש', 'הולכים לקניון שלא הייתם בו', 'shopping', 'halfday', 400, 'shopping'),
  ('בושם חדש', 'הולכים יחד לבחור בושם', 'shopping', 'short', 350, 'perfume'),
  ('סדנת הכנת בושם', 'מרכיבים בושם אישי משלה', 'shopping', 'short', 380, 'perfume'),
  ('סטייליסטית אישית', 'ייעוץ סטיילינג ובחירת פריט מיוחד', 'shopping', 'halfday', 600, 'fashion'),
  ('פריט אופנה מיוחד', 'פריט אחד שהיא רצתה הרבה זמן', 'shopping', 'short', 450, 'fashion'),
  ('מעצבים צעירים', 'חנויות מעצבים ברחוב שופינג', 'shopping', 'halfday', 400, 'fashion'),
  ('תכשיט קטן', 'בוחרים יחד תכשיט עדין', 'shopping', 'short', 500, 'jewelry'),
  ('סדנת תכשיטים', 'מכינים תכשיט בעבודת יד', 'shopping', 'short', 420, 'jewelry'),
  ('שוק פשפשים', 'יפו, ומציאות שמוצאים יחד', 'shopping', 'halfday', 200, 'market'),
  ('שופינג לבית', 'בוחרים יחד משהו יפה לבית', 'shopping', 'halfday', 450, 'gift'),
  ('חנות ספרים ויין', 'בוחרים ספר אחד לכל אחד ויושבים על כוס יין', 'shopping', 'short', 250, 'gift'),
  ('הופעה', 'הופעה של אמן שהיא אוהבת', 'experiences', 'evening', 500, 'concert'),
  ('הופעה קטנה במועדון', 'הופעה אינטימית מקרוב', 'experiences', 'evening', 300, 'concert'),
  ('ערב ג''אז', 'בר ג''אז עם מוזיקה חיה', 'experiences', 'evening', 280, 'jazz'),
  ('סטנדאפ', 'ערב צחוק בקומדי בר', 'experiences', 'evening', 260, 'comedy'),
  ('קולנוע VIP', 'כורסאות, שמיכה וארוחה קטנה', 'experiences', 'evening', 240, 'cinema'),
  ('הצגה', 'הצגה טובה ואחריה משקה', 'experiences', 'evening', 450, 'theater'),
  ('מחזמר', 'מחזמר גדול בהיכל התרבות', 'experiences', 'evening', 550, 'theater'),
  ('אופרה או בלט', 'ערב אלגנטי, מתלבשים יפה', 'experiences', 'evening', 550, 'theater'),
  ('שיעור ריקודים זוגי', 'סלסה, בצ''אטה או טנגו', 'experiences', 'evening', 250, 'dance'),
  ('חדר בריחה', 'שעה של חשיבה משותפת', 'experiences', 'short', 320, 'escape'),
  ('סדנת קרמיקה', 'מכינים כלי על האובניים', 'experiences', 'short', 400, 'pottery'),
  ('ציור ויין', 'סדנת ציור עם כוס יין', 'experiences', 'evening', 320, 'art'),
  ('תערוכה ומוזיאון', 'תערוכה מתחלפת ואחריה ארוחה', 'experiences', 'halfday', 300, 'art'),
  ('באולינג וקוקטייל', 'באולינג בוטיק עם בר', 'experiences', 'evening', 250, 'games'),
  ('שייט שקיעה', 'שייט ביאכטה מהמרינה', 'experiences', 'short', 500, 'boat'),
  ('כדור פורח', 'טיסה בכדור פורח בעמק', 'experiences', 'fullday', 600, 'balloon'),
  ('לילה במלון בעיר', 'באמצע השבוע, כשזה שקט וזול', 'experiences', 'overnight', 600, 'hotel'),
  ('מלון בוטיק', 'מלון קטן ומעוצב בעיר אחרת', 'experiences', 'overnight', 600, 'hotel'),
  ('צימר באמצע השבוע', 'בריחה קטנה מהשגרה', 'experiences', 'overnight', 600, 'cabin'),
  ('לינה במדבר', 'אוהל מפנק, שמיים מלאי כוכבים', 'experiences', 'overnight', 550, 'desert'),
  ('יום בים המלח', 'מלון, בריכה ובוץ', 'experiences', 'fullday', 500, 'beach'),
  ('בית קפה על החוף', 'בוקר על החוף עם קפה טוב', 'experiences', 'short', 150, 'beach'),
  ('נסיעה ליום באילת', 'טיסה בבוקר וחזרה בלילה', 'experiences', 'fullday', 600, 'flight'),
  ('טיול יום בצפון', 'יקב, ארוחה טובה ונוף', 'experiences', 'fullday', 500, 'car'),
  ('טיול יום בירושלים', 'שוק, מסעדה ומוזיאון', 'experiences', 'fullday', 450, 'car'),
  ('תכנון החופשה הבאה', 'ערב של חלומות: בוחרים יעד ומזמינים', 'experiences', 'evening', 100, 'flight'),
  ('דייט הפתעה', 'אחד מתכנן והשני לא יודע לאן', 'experiences', 'evening', 450, 'gift'),
  ('ארוחה עם זוג חברים', 'מסעדה טובה עם זוג שכיף איתו', 'people', 'evening', 450, 'friends'),
  ('ערב משחקי קופסה', 'מארחים חברים לערב משחקים ויין', 'people', 'evening', 150, 'games'),
  ('ערב אירוח', 'מבשלים יחד ומזמינים חברים', 'people', 'evening', 300, 'friends'),
  ('סדנה עם זוגות', 'סדנת יין או בישול עם זוגות נוספים', 'people', 'evening', 500, 'cooking'),
  ('ערב עם עמיתות שלה', 'מפגש עם מטפלות מהתחום שלה', 'people', 'evening', 200, 'friends'),
  ('ערב קריוקי', 'קריוקי בחדר פרטי עם חברים', 'people', 'evening', 300, 'concert'),
  ('חדר בריחה עם חברים', 'שני זוגות נגד השעון', 'people', 'short', 400, 'escape'),
  ('ברביקיו אצל חברים', 'על האש בחצר של חברים', 'people', 'evening', 200, 'grill'),
  ('מסיבת יום הולדת קטנה', 'מפתיעים מישהו קרוב', 'people', 'evening', 350, 'gift'),
  ('סיור קולינרי קבוצתי', 'סיור טעימות עם קבוצה', 'people', 'halfday', 400, 'market')
) as v(title, description, category, duration, cost, art)
where not exists (select 1 from public.ideas);

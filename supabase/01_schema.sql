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
  created_by  text check (created_by in ('tal','eilat')),
  created_at  timestamptz not null default now()
);

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
alter table public.push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ideas','votes','messages','dates','push_subscriptions'] loop
    execute format('drop policy if exists couple_all on public.%I', t);
    execute format('create policy couple_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- עדכונים חיים (צ'אט, הצבעות, דייטים)
do $$
declare t text;
begin
  foreach t in array array['messages','votes','dates','ideas'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------
-- מאגר רעיונות התחלתי (פינוק, 500–600 ₪ לשבוע)
-- ------------------------------------------------------------
insert into public.ideas (title, description, category, duration, cost)
select * from (values
  ('ארוחת בוקר מפנקת', 'בית קפה שעוד לא הייתם בו, בלי למהר', 'food', 'short', 180),
  ('סושי בר', 'ערב יפני קליל על הבר', 'food', 'evening', 300),
  ('מסעדת שף', 'ארוחה טובה באמת, עם קינוח משותף', 'food', 'evening', 550),
  ('ארוחת טעימות', 'תפריט טעימות של כמה מנות קטנות', 'food', 'evening', 600),
  ('מטבח שלא ניסיתם', 'פרואני, תאילנדי, גאורגי או אתיופי', 'food', 'evening', 320),
  ('סדנת בישול זוגית', 'מבשלים יחד ואוכלים את מה שהכנתם', 'food', 'evening', 500),
  ('ערב טעימות יין', 'יקב או בר יין עם פלטת גבינות', 'food', 'evening', 380),
  ('עיסוי זוגי', 'עיסוי של שעה זה לצד זה', 'spa', 'short', 550),
  ('מתחם ספא', 'כמה שעות של בריכה, ג׳קוזי וסאונה', 'spa', 'halfday', 500),
  ('יום פינוק במלון', 'בריכה ופינוק בלי ללון', 'spa', 'halfday', 450),
  ('טיפול פנים לה', 'טיפול פנים מפנק, ואתה מחכה עם קפה', 'spa', 'short', 280),
  ('ספא ביתי', 'מסכות, נרות, שמנים וארוחה מוזמנת', 'spa', 'evening', 200),
  ('יום קניות שלה', 'תקציב שמיועד רק לה, עם קפה באמצע', 'shopping', 'halfday', 500),
  ('בושם חדש', 'הולכים יחד לבחור בושם', 'shopping', 'short', 350),
  ('סטייליסטית אישית', 'ייעוץ סטיילינג ובחירת פריט מיוחד', 'shopping', 'halfday', 600),
  ('פריט אופנה מיוחד', 'פריט אחד שהיא רצתה הרבה זמן', 'shopping', 'short', 450),
  ('הופעה', 'הופעה של אמן שהיא אוהבת', 'experiences', 'evening', 500),
  ('סטנדאפ', 'ערב צחוק בקומדי בר', 'experiences', 'evening', 260),
  ('קולנוע VIP', 'כורסאות, שמיכה וארוחה קטנה', 'experiences', 'evening', 220),
  ('הצגה', 'הצגה טובה ואחריה משקה', 'experiences', 'evening', 450),
  ('בר עם מוזיקה חיה', 'קוקטיילים וג׳אז', 'experiences', 'evening', 250),
  ('לילה במלון בעיר', 'באמצע השבוע, כשזה שקט וזול', 'experiences', 'overnight', 600),
  ('צימר באמצע השבוע', 'בריחה קטנה מהשגרה', 'experiences', 'overnight', 600),
  ('ארוחה עם זוג חברים', 'מסעדה טובה עם זוג שכיף איתו', 'people', 'evening', 450),
  ('סדנה עם זוגות', 'סדנת יין או בישול עם זוגות נוספים', 'people', 'evening', 500),
  ('ערב עם עמיתות שלה', 'מפגש עם מטפלות מהתחום שלה', 'people', 'evening', 200)
) as v(title, description, category, duration, cost)
where not exists (select 1 from public.ideas);

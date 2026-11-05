-- קטגוריות חדשות, שפת האהבה
alter table public.ideas drop constraint if exists ideas_category_check;
alter table public.ideas add constraint ideas_category_check check (category in
  ('food','spa','shopping','experiences','people','calm','sport','nature','learn','create','romantic','closeness'));

create table if not exists public.love_profiles (
  profile    text primary key check (profile in ('tal','eilat')),
  scores     jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.love_log (
  id         bigint generated always as identity primary key,
  profile    text not null check (profile in ('tal','eilat')),
  lang       text not null check (lang in ('words','time','gifts','acts','touch')),
  kind       text not null default 'manual',
  week       text,
  created_at timestamptz not null default now()
);
alter table public.love_profiles enable row level security;
alter table public.love_log      enable row level security;
drop policy if exists couple_all on public.love_profiles;
create policy couple_all on public.love_profiles for all to authenticated using (true) with check (true);
drop policy if exists couple_all on public.love_log;
create policy couple_all on public.love_log for all to authenticated using (true) with check (true);
do $$ declare t text; begin
  foreach t in array array['love_profiles','love_log'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

with seed (title, description, category, duration, cost, art) as (values
  ('ערב סרט עם שמיכה', 'בוחרים סרט, מכינים פופקורן ומתכרבלים', 'calm', 'evening', 30, 'sofa'),
  ('מבשלים ביחד בבית', 'מתכון חדש, מוזיקה טובה וכוס יין', 'calm', 'evening', 120, 'cooking'),
  ('פיקניק במרפסת', 'פלטת גבינות, נרות ושמיכה על הרצפה', 'calm', 'evening', 100, 'picnic'),
  ('קפה ומאפה בשכונה', 'בוקר רגוע בבית הקפה הקרוב', 'calm', 'short', 60, 'coffee'),
  ('אלבום תמונות ישן', 'עוברים ביחד על תמונות מהשנים הראשונות', 'calm', 'short', 0, 'photo'),
  ('אפייה ביחד', 'עוגה או עוגיות, ואוכלים חמות', 'calm', 'short', 40, 'bake'),
  ('ערב קריאה', 'כל אחד עם ספר, תה ושקט ביחד', 'calm', 'evening', 0, 'book'),
  ('פאזל גדול', 'פאזל של 1000 חלקים על שולחן הסלון', 'calm', 'evening', 80, 'puzzle'),
  ('ארוחת בוקר במיטה', 'אחד מכין, השני מתפנק', 'calm', 'short', 50, 'coffee'),
  ('ערב פודקאסט', 'שומעים ביחד פרק ומדברים עליו', 'calm', 'evening', 0, 'talk'),
  ('סדרה חדשה', 'מתחילים סדרה חדשה רק שנינו', 'calm', 'evening', 0, 'sofa'),
  ('משלוח מהמסעדה האהובה', 'ערב בבית עם האוכל שהכי אוהבים', 'calm', 'evening', 180, 'dinner'),
  ('שתילת עציצים', 'קונים עציצים ומסדרים פינה ירוקה', 'calm', 'short', 100, 'plant'),
  ('ספא ביתי קטן', 'מסכות פנים ומוזיקה רגועה', 'calm', 'evening', 60, 'candles'),
  ('הליכת ערב בשכונה', 'הליכה איטית ושיחה, בלי יעד', 'calm', 'short', 0, 'talk'),
  ('ערב משחקי קופסה', 'רק שנינו, עם חטיפים', 'calm', 'evening', 0, 'games'),
  ('ערב גלידה ושקיעה', 'גלידה בכוס ויושבים על ספסל מול הים', 'calm', 'short', 50, 'beach'),
  ('לבשל ארוחה של סבתא', 'משחזרים מתכון משפחתי ומספרים זכרונות', 'calm', 'evening', 80, 'cooking'),
  ('שינה ארוכה בשבת', 'בלי שעון מעורר, וקפה במיטה', 'calm', 'halfday', 0, 'hotel'),
  ('תה וטלפונים בצד', 'שעה אחת של שיחה בלי מסכים', 'calm', 'short', 0, 'talk'),
  ('שיעור יוגה זוגי', 'יוגה לזוגות, ואחריו מיץ טבעי', 'sport', 'short', 160, 'yoga'),
  ('אופניים בפארק הירקון', 'רוכבים לאורך הירקון עם עצירה לקפה', 'sport', 'halfday', 80, 'bike'),
  ('טניס או פאדל', 'משחק זוגי במגרש שכונתי', 'sport', 'short', 120, 'tennis'),
  ('שחייה ביחד', 'בריכה או ים בבוקר', 'sport', 'short', 80, 'pool'),
  ('קיר טיפוס', 'מתחם בולדרינג למתחילים', 'sport', 'short', 200, 'climb'),
  ('סאפ בים', 'גלישת סאפ בשעות הבוקר השקטות', 'sport', 'short', 250, 'sup'),
  ('הליכה בטבע', 'שביל קצר של שעה-שעתיים', 'sport', 'halfday', 0, 'hike'),
  ('ריצה קלה ביחד', 'ריצה של 3 ק"מ ואחריה ארוחת בוקר', 'sport', 'short', 60, 'hike'),
  ('פילאטיס זוגי', 'שיעור ניסיון לזוגות', 'sport', 'short', 150, 'yoga'),
  ('קורקינטים חשמליים', 'סיבוב ערב לאורך הטיילת', 'sport', 'short', 80, 'bike'),
  ('קיאקים בנהר', 'שייט קיאקים בירדן', 'sport', 'halfday', 300, 'sup'),
  ('באולינג וספורט', 'ערב במתחם ספורט ופעילות', 'sport', 'evening', 200, 'games'),
  ('מעיין בהרי ירושלים', 'טבילה במעיין ופיקניק קטן', 'nature', 'halfday', 50, 'spring'),
  ('זריחה בים', 'קמים מוקדם, קפה בתרמוס ושמש עולה', 'nature', 'short', 20, 'sunrise'),
  ('קטיף פירות', 'קטיף עונתי בחווה', 'nature', 'halfday', 120, 'flowers'),
  ('שדות פרחים', 'כלניות או חמניות, לפי העונה', 'nature', 'halfday', 0, 'flowers'),
  ('תצפית כוכבים', 'נוסעים רחוק מהאורות עם שמיכה', 'nature', 'evening', 0, 'desert'),
  ('נחל עם מים', 'מסלול קצר בנחל זורם', 'nature', 'halfday', 0, 'spring'),
  ('חוף שקט', 'חוף פחות מוכר, בלי המון', 'nature', 'halfday', 0, 'beach'),
  ('גן בוטני', 'טיול רגוע בין צמחים ופרחים', 'nature', 'short', 60, 'plant'),
  ('שיעור צילום', 'סדנה קצרה ואז מצלמים אחד את השני', 'learn', 'halfday', 300, 'photo'),
  ('קורס יין קצר', 'מפגש טעימות עם הסבר', 'learn', 'evening', 350, 'wine'),
  ('שיעור בישול', 'מטבח שלא מכירים, עם שף', 'learn', 'evening', 450, 'cooking'),
  ('סדנת קוקטיילים', 'לומדים להכין שלושה קוקטיילים', 'learn', 'evening', 320, 'cocktail'),
  ('שיעור ריקוד', 'שיעור ניסיון בסלסה או בטנגו', 'learn', 'evening', 150, 'dance'),
  ('הרצאה מעניינת', 'הרצאה בנושא שאף אחד מכם לא מכיר', 'learn', 'evening', 120, 'talk'),
  ('סדנת קליגרפיה', 'כותבים יפה, ומכינים כרטיס אחד לשני', 'learn', 'short', 200, 'letter'),
  ('שפה חדשה', 'לומדים עשר מילים בשפה של הטיול הבא', 'learn', 'short', 0, 'flight'),
  ('ציור ביחד', 'בד, צבעים ומוזיקה, כל אחד מצייר את השני', 'create', 'evening', 120, 'art'),
  ('קולאז'' זכרונות', 'מדפיסים תמונות ומכינים קולאז'' לקיר', 'create', 'evening', 80, 'photo'),
  ('להרכיב משהו לבית', 'מדף, מנורה או ארגונית', 'create', 'short', 200, 'puzzle'),
  ('עוגה מעוצבת', 'אופים ומקשטים עוגה מושקעת', 'create', 'short', 80, 'bake'),
  ('סידור פרחים', 'קונים פרחים בשוק ומסדרים זרים', 'create', 'short', 120, 'flowers'),
  ('נרות בעבודת יד', 'יוצקים נרות ריחניים בבית', 'create', 'evening', 120, 'candles'),
  ('אלבום דיגיטלי', 'מסדרים את תמונות השנה לאלבום מודפס', 'create', 'evening', 150, 'photo'),
  ('ספר מתכונים משותף', 'כותבים את המתכונים שאנחנו הכי אוהבים', 'create', 'evening', 0, 'book'),
  ('מכתב אהבה', 'כל אחד כותב מכתב לשני וקוראים ביחד', 'romantic', 'short', 0, 'letter'),
  ('ארוחת נרות בבית', 'שולחן ערוך, מוזיקה ובגדים יפים', 'romantic', 'evening', 200, 'candles'),
  ('לחזור לדייט הראשון', 'חוזרים למקום שבו נפגשתם', 'romantic', 'evening', 250, 'dinner'),
  ('לרקוד בסלון', 'השיר של החתונה ועוד כמה', 'romantic', 'short', 0, 'dance'),
  ('שקיעה עם יין', 'בקבוק יין ושקיעה במקום יפה', 'romantic', 'short', 100, 'wine'),
  ('צנצנת אהבה', 'ממלאים צנצנת בפתקים של דברים שאוהבים', 'romantic', 'short', 20, 'letter'),
  ('לבחור שיר שלנו', 'בונים רשימת שירים משותפת', 'romantic', 'short', 0, 'concert'),
  ('מקלחת ונרות', 'אמבטיה חמה, נרות ושמן ריחני', 'romantic', 'evening', 60, 'candles'),
  ('משחק שאלות לזוגות', '36 שאלות שמקרבות', 'closeness', 'evening', 0, 'talk'),
  ('לתכנן חלומות', 'מה אנחנו רוצים לעשות בשנה הקרובה', 'closeness', 'evening', 0, 'talk'),
  ('תמונות ישנות וסיפורים', 'כל אחד מספר סיפור מהילדות', 'closeness', 'short', 0, 'photo'),
  ('שלושה דברים טובים', 'כל אחד מספר שלושה דברים טובים מהשבוע', 'closeness', 'short', 0, 'talk'),
  ('מכתב לעצמנו בעוד שנה', 'כותבים ביחד ופותחים בעוד שנה', 'closeness', 'short', 0, 'letter'),
  ('ערב של תודה', 'כל אחד אומר על מה הוא מודה לשני', 'closeness', 'short', 0, 'letter'),
  ('לתכנן את הטיול הבא', 'בוחרים יעד ומדמיינים יחד', 'closeness', 'evening', 0, 'flight'),
  ('שיחה על ההורים שלנו', 'מה למדנו מהם, ומה נרצה לעשות אחרת', 'closeness', 'evening', 0, 'talk')
)
insert into public.ideas (title, description, category, duration, cost, art)
select seed.title, seed.description, seed.category, seed.duration, seed.cost, seed.art from seed
where not exists (select 1 from public.ideas i where i.title = seed.title);

notify pgrst, 'reload schema';

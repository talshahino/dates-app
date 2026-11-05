-- דייט בהפתעה: רמזים ומועד חשיפה
alter table public.dates add column if not exists hints jsonb not null default '[]'::jsonb;
alter table public.dates add column if not exists reveal_at timestamptz;
alter table public.dates add column if not exists revealed_by text check (revealed_by in ('tal','eilat'));
notify pgrst, 'reload schema';

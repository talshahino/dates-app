select
  pg_size_pretty(pg_database_size(current_database())) as db_size,
  (select count(*) from storage.objects where bucket_id = 'memories') as files,
  (select pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) from storage.objects where bucket_id = 'memories') as files_size,
  (select count(*) from public.memories) as memories,
  (select count(*) from public.movies) as movies,
  (select count(*) from public.messages) as messages,
  (select count(*) from public.dates) as dates;

-- One lowercase text column to search: caption, AI summary, author and tags,
-- so "dark" finds the tag "dark mode".
create or replace function public.immutable_tags_text(tags text[])
returns text language sql immutable as $$ select array_to_string(tags, ' ') $$;

alter table public.items add column search text generated always as (
  lower(coalesce(body, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(author, '') || ' ' || public.immutable_tags_text(tags))
) stored;

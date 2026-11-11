-- Swipefile: one table of saves, one private bucket of images.
-- Every read and write goes through the `inspo` edge function (service role),
-- so RLS is on with no policies: the anon key can't touch anything.

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('x', 'instagram', 'screenshot', 'link')),
  url           text,
  external_id   text,                       -- tweet id / instagram shortcode
  author        text,
  body          text,                       -- tweet text or shared text
  images        jsonb not null default '[]'::jsonb,  -- [{path, width, height}]
  video_url     text,                       -- original video, when the post was a video
  status        text not null default 'processing'
                check (status in ('processing', 'ready', 'needs_image', 'error')),
  error         text,
  tags          text[] not null default '{}',
  summary       text,
  palette       text[] not null default '{}',
  starred       boolean not null default false,
  archived      boolean not null default false,
  seen_count    integer not null default 0,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- One row per post, so a share and a later bookmark sync never duplicate.
create unique index items_source_external_id on public.items (source, external_id)
  where external_id is not null;
create index items_created_at on public.items (created_at desc);
create index items_tags on public.items using gin (tags);

alter table public.items enable row level security;

-- Small key/value store for things like X OAuth tokens.
create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

-- Today's 5: mostly the saves you've seen least recently, with a little chance mixed in.
create or replace function public.pick_today(n integer default 5)
returns setof public.items
language sql
as $$
  select *
  from public.items
  where not archived and status in ('ready', 'needs_image')
  order by
    (last_seen_at is not null),                          -- never-seen first
    coalesce(last_seen_at, created_at) + (random() * interval '3 days')
  limit n;
$$;

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

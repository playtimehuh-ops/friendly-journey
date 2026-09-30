create table if not exists public.modeldock_models (
  id text primary key,
  owner_hash text not null,
  name text not null,
  version text not null,
  info text not null default '',
  visibility text not null default 'private',
  price numeric(10,2) not null default 0,
  active boolean not null default false,
  paid boolean not null default false,
  params bigint not null default 0,
  package jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists modeldock_owner_idx on public.modeldock_models(owner_hash);
create index if not exists modeldock_public_idx on public.modeldock_models(id,visibility,active);
alter table public.modeldock_models enable row level security;
create or replace function public.modeldock_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists modeldock_touch on public.modeldock_models;
create trigger modeldock_touch before update on public.modeldock_models for each row execute function public.modeldock_touch_updated_at();
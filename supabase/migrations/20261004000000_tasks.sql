-- Дела пользователей. Само дело хранится целиком в data (jsonb) —
-- так формат дела можно менять в приложении без миграций.
-- deleted = true вместо удаления строки: другие устройства узнают об удалении при синхронизации.

create table public.tasks (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index tasks_user_updated_idx on public.tasks (user_id, updated_at);

-- updated_at ставит сервер: по нему устройства забирают только изменившееся
create function public.tasks_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_touch
before insert or update on public.tasks
for each row execute function public.tasks_touch();

-- Каждый видит и меняет только свои дела
alter table public.tasks enable row level security;

create policy "tasks: select own" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "tasks: insert own" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "tasks: update own" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tasks: delete own" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.tasks from anon;

-- Настройки пользователя (свои категории и т.п.) — одна строка на пользователя
create table public.settings (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger settings_touch
before insert or update on public.settings
for each row execute function public.tasks_touch();

alter table public.settings enable row level security;

create policy "settings: select own" on public.settings
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "settings: insert own" on public.settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "settings: update own" on public.settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.settings from anon;

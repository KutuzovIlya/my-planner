-- Заработок пользователей — устроено так же, как tasks: запись целиком в data (jsonb),
-- deleted = true вместо удаления строки, updated_at ставит сервер.

create table public.income (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index income_user_updated_idx on public.income (user_id, updated_at);

create trigger income_touch
before insert or update on public.income
for each row execute function public.tasks_touch();

alter table public.income enable row level security;

create policy "income: select own" on public.income
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "income: insert own" on public.income
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "income: update own" on public.income
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "income: delete own" on public.income
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.income from anon;

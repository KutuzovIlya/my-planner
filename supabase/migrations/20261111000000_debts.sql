-- Должники пользователей — устроено так же, как tasks и income: запись целиком в data (jsonb),
-- deleted = true вместо удаления строки, updated_at ставит сервер.

create table public.debts (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index debts_user_updated_idx on public.debts (user_id, updated_at);

create trigger debts_touch
before insert or update on public.debts
for each row execute function public.tasks_touch();

alter table public.debts enable row level security;

create policy "debts: select own" on public.debts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "debts: insert own" on public.debts
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "debts: update own" on public.debts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "debts: delete own" on public.debts
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.debts from anon;

-- Копилка: взносы пользователя — устроено так же, как tasks и income: запись целиком в data (jsonb),
-- deleted = true вместо удаления строки, updated_at ставит сервер.

create table public.savings (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index savings_user_updated_idx on public.savings (user_id, updated_at);

create trigger savings_touch
before insert or update on public.savings
for each row execute function public.tasks_touch();

alter table public.savings enable row level security;

create policy "savings: select own" on public.savings
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "savings: insert own" on public.savings
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "savings: update own" on public.savings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "savings: delete own" on public.savings
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.savings from anon;

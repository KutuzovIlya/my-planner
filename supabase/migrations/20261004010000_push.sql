-- Пуш-уведомления: подписки устройств, журнал отправленного, ежеминутный запуск рассылки.

create table public.push_subscriptions (
  endpoint     text        primary key,
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh       text        not null,
  auth         text        not null,
  -- часовой пояс устройства: напоминания считаются по местному времени
  tz           text        not null default 'UTC',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: select own" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push: insert own" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push: update own" on public.push_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "push: delete own" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon;

-- Что уже отправлено (чтобы не напомнить дважды). Доступ только у сервера.
create table public.sent_notifications (
  user_id uuid        not null references auth.users (id) on delete cascade,
  key     text        not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.sent_notifications enable row level security;
revoke all on public.sent_notifications from anon, authenticated;

-- Каждую минуту — функция send-reminders. Секрет для неё лежит в Vault (cron_secret),
-- в миграции его нет.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bzdaignezrrzxdkyujxg.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Журнал отправленного старше трёх дней не нужен
select cron.schedule(
  'cleanup-sent-notifications',
  '17 3 * * *',
  $$ delete from public.sent_notifications where sent_at < now() - interval '3 days' $$
);

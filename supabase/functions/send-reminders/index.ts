// Рассылка напоминаний. Вызывается:
//  • cron каждую минуту (заголовок x-cron-secret) — проверяет, кому пора напомнить;
//  • из приложения с токеном пользователя и { test: true } — пробное уведомление.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SITE = 'https://kutuzovilya.github.io/my-planner/'
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(SITE, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** насколько назад смотреть: cron может опоздать на минуту-другую */
const WINDOW_MIN = 3

interface Task {
  id: string
  title: string
  date: string | null
  start: number | null
  duration: number
  repeat: 'none' | 'daily' | 'weekdays' | 'weekly'
  until?: string | null
  done: boolean
  doneDates: string[]
  remind?: number | null
}
interface Prefs {
  notifications?: boolean
  defaultRemind?: number | null
  morningPlan?: boolean
  morningTime?: number
}
interface Sub {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  tz: string
}

// ——— даты (как в приложении, src/store.ts) ———
const dayNum = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000
const keyOf = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)
const weekday = (key: string) => new Date(dayNum(key) * 86400000).getUTCDay()

function occursOn(t: Task, day: string): boolean {
  if (!t.date) return false
  if (t.repeat === 'none') return t.date === day
  if (dayNum(day) < dayNum(t.date)) return false
  if (t.until && dayNum(day) > dayNum(t.until)) return false
  const wd = weekday(day)
  if (t.repeat === 'daily') return true
  if (t.repeat === 'weekdays') return wd >= 1 && wd <= 5
  return wd === weekday(t.date)
}
const isDone = (t: Task, day: string) => (t.repeat === 'none' ? t.done : (t.doneDates ?? []).includes(day))
const hhmm = (m: number) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`

/** Местные дата и минуты от полуночи в часовом поясе */
function localNow(tz: string): { day: string; min: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  } catch {
    return localNow('UTC')
  }
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { day: `${get('year')}-${get('month')}-${get('day')}`, min: +get('hour') * 60 + +get('minute') }
}

function beforeText(remind: number, start: number): string {
  if (remind === 0) return 'Начинается сейчас'
  if (remind === 1440) return `Завтра в ${hhmm(start)}`
  if (remind === 60) return 'Через час'
  if (remind === 120) return 'Через 2 часа'
  return `Через ${remind} мин`
}

async function send(sub: Sub, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' })
    return true
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    // подписка больше не действует (удалили приложение, отозвали разрешение)
    if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    else console.error('push failed', code, (e as Error).message)
    return false
  }
}

/** Отметить как отправленное; false — уже отправляли */
async function claim(userId: string, key: string): Promise<boolean> {
  const { data, error } = await db.from('sent_notifications').upsert({ user_id: userId, key }, { onConflict: 'user_id,key', ignoreDuplicates: true }).select('key')
  if (error) {
    console.error('claim failed', error.message)
    return false
  }
  return (data ?? []).length > 0
}

async function runForUser(userId: string, subs: Sub[]) {
  const { data: settings } = await db.from('settings').select('data').eq('user_id', userId).maybeSingle()
  const prefs: Prefs = (settings?.data as { prefs?: Prefs } | null)?.prefs ?? {}
  if (!prefs.notifications) return 0

  const { day: today, min: now } = localNow(subs[0].tz)
  const tomorrow = keyOf(dayNum(today) + 1)
  const { data: rows } = await db.from('tasks').select('data').eq('user_id', userId).eq('deleted', false)
  const tasks = (rows ?? []).map((r) => r.data as Task)
  const due: { key: string; payload: Record<string, unknown> }[] = []

  for (const t of tasks) {
    if (t.start === null || t.start === undefined) continue
    const remind = t.remind === undefined ? (prefs.defaultRemind ?? 10) : t.remind
    if (remind === null) continue
    for (const [d, offset] of [[today, 0], [tomorrow, 1440]] as const) {
      if (!occursOn(t, d) || isDone(t, d)) continue
      const fire = offset + t.start - remind
      if (fire > now || fire <= now - WINDOW_MIN) continue
      due.push({
        key: `${t.id}:${d}:${remind}`,
        payload: { title: t.title, body: `${beforeText(remind, t.start)} · ${hhmm(t.start)}–${hhmm(t.start + t.duration)}`, tag: `${t.id}:${d}`, url: SITE },
      })
    }
  }

  const morning = prefs.morningTime ?? 480
  if (prefs.morningPlan && morning <= now && morning > now - WINDOW_MIN) {
    const list = tasks
      .filter((t) => occursOn(t, today) && !isDone(t, today))
      .sort((a, b) => (a.start ?? 1e4) - (b.start ?? 1e4))
    const body = list.length
      ? list.slice(0, 6).map((t) => (t.start !== null ? `${hhmm(t.start)} ${t.title}` : t.title)).join('\n') + (list.length > 6 ? `\n…и ещё ${list.length - 6}` : '')
      : 'Дел на сегодня нет — можно что-нибудь запланировать'
    due.push({ key: `morning:${today}`, payload: { title: list.length ? `План на сегодня · ${list.length}` : 'План на сегодня', body, tag: `morning:${today}`, url: SITE } })
  }

  let sent = 0
  for (const n of due) {
    if (!(await claim(userId, n.key))) continue
    for (const s of subs) if (await send(s, n.payload)) sent++
  }
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))

  // пробное уведомление от пользователя
  if (body?.test) {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: user } = await db.auth.getUser(jwt)
    if (!user?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors })
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', user.user.id)
    let sent = 0
    for (const s of (subs ?? []) as Sub[]) {
      if (await send(s, { title: 'Уведомления работают', body: 'Так будут выглядеть напоминания о делах', tag: 'test', url: SITE })) sent++
    }
    return new Response(JSON.stringify({ sent, devices: subs?.length ?? 0 }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ежеминутный запуск
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 })
  const { data: subs, error } = await db.from('push_subscriptions').select('*')
  if (error) return new Response(error.message, { status: 500 })
  const byUser = new Map<string, Sub[]>()
  for (const s of subs as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  let sent = 0
  for (const [userId, list] of byUser) sent += await runForUser(userId, list)
  return new Response(JSON.stringify({ users: byUser.size, sent }), { headers: { 'Content-Type': 'application/json' } })
})

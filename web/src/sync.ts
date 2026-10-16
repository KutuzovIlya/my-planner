import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'
import { applyRemoteCategories, DEFAULT_CATEGORIES, getCategories, onCategoriesChange, resetCategories, type CategoryDef } from './categories'
import { subscribePush, unsubscribePush } from './push'
import { applyRemotePrefs, getPrefs, onPrefsChange, resetPrefs, type Prefs } from './prefs'
import { applyRemote, clearLocal, getTasks, onLocalChange, type Task } from './store'
import { applyRemoteIncome, clearLocalIncome, getIncome, onIncomeChange, type Income } from './money'

// Синхронизация «сначала локально»: дела живут в localStorage и работают без сети,
// изменения копятся в очереди и уходят на сервер; с сервера забираем только изменившееся.

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error'

interface SyncState {
  /** сессия уже восстановлена (или Supabase не настроен) */
  ready: boolean
  session: Session | null
  status: SyncStatus
  lastSync: number | null
  /** открыли ссылку «сбросить пароль» — нужно задать новый */
  recovery: boolean
}

const OWNER_KEY = 'planner.owner'
const SKIP_KEY = 'planner.skip-auth'
const SETTINGS_KEY = 'planner.settings-sync'

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    // нет хранилища — работаем в памяти
  }
}

// ——— коллекции: дела и заработок; у каждой своя таблица и своя очередь изменений ———

type Pending<T> = Record<string, { deleted: boolean; item?: T }>

function collection<T extends { id: string }>(
  table: string,
  pendingKey: string,
  sinceKey: string,
  getAll: () => T[],
  apply: (upserts: T[], deletes: string[]) => void,
  clear: () => void,
) {
  // старый формат очереди дел: { deleted, task }
  const raw = read<Record<string, { deleted: boolean; item?: T; task?: T }>>(pendingKey, {})
  let pending: Pending<T> = Object.fromEntries(Object.entries(raw).map(([id, p]) => [id, { deleted: p.deleted, item: p.item ?? p.task }]))

  const save = () => write(pendingKey, pending)
  return {
    count: () => Object.keys(pending).length,
    enqueue(id: string, item: T | null) {
      if (!st.session) return
      pending = { ...pending, [id]: item ? { deleted: false, item } : { deleted: true } }
      save()
      scheduleFlush()
    },
    async flush(session: Session) {
      const entries = Object.entries(pending)
      if (!entries.length) return
      const rows = entries.map(([id, p]) => ({ user_id: session.user.id, id, data: p.item ?? {}, deleted: p.deleted }))
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' })
      if (error) throw error
      // убираем из очереди только то, что не менялось, пока шёл запрос
      const next = { ...pending }
      for (const [id, p] of entries) if (next[id] === p) delete next[id]
      pending = next
      save()
    },
    async pull() {
      let since = read<string | null>(sinceKey, null)
      for (;;) {
        let q = supabase.from(table).select('id, data, deleted, updated_at').order('updated_at').limit(500)
        if (since) q = q.gt('updated_at', since)
        const { data, error } = await q
        if (error) throw error
        if (!data.length) break
        const fresh = data.filter((r) => !pending[r.id]) // локальные неотправленные правки важнее
        apply(
          fresh.filter((r) => !r.deleted).map((r) => r.data as T),
          fresh.filter((r) => r.deleted).map((r) => r.id),
        )
        since = data[data.length - 1].updated_at
        write(sinceKey, JSON.stringify(since))
        if (data.length < 500) break
      }
    },
    /** первый вход: созданное без аккаунта переезжает в аккаунт */
    adoptLocal() {
      for (const item of getAll()) pending[item.id] = { deleted: false, item }
      save()
      write(sinceKey, null)
    },
    reset() {
      clear()
      pending = {}
      write(pendingKey, null)
      write(sinceKey, null)
    },
  }
}

const tasksSync = collection<Task>('tasks', 'planner.pending', 'planner.since', getTasks, applyRemote, clearLocal)
const incomeSync = collection<Income>('income', 'planner.pending-income', 'planner.since-income', getIncome, applyRemoteIncome, clearLocalIncome)
const collections = [tasksSync, incomeSync]

// категории: dirty — есть неотправленные правки; merge — первый вход, объединить с облаком
let settingsSync: { dirty: boolean; merge: boolean } = read(SETTINGS_KEY, { dirty: false, merge: false })
const setSettingsSync = (patch: Partial<typeof settingsSync>) => {
  settingsSync = { ...settingsSync, ...patch }
  write(SETTINGS_KEY, settingsSync)
}
let st: SyncState = { ready: !supabaseConfigured, session: null, status: 'local', lastSync: null, recovery: false }
const listeners = new Set<() => void>()
const set = (patch: Partial<SyncState>) => {
  st = { ...st, ...patch }
  listeners.forEach((l) => l())
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => st,
  )
}

let flushTimer = 0
function scheduleFlush() {
  clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => void sync(), 600)
}

async function flushSettings(session: Session) {
  if (!settingsSync.dirty || settingsSync.merge) return
  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: session.user.id, data: { categories: getCategories(), prefs: getPrefs() } }, { onConflict: 'user_id' })
  if (error) throw error
  setSettingsSync({ dirty: false })
}

async function pullSettings() {
  const { data, error } = await supabase.from('settings').select('data').maybeSingle()
  if (error) throw error
  const remoteData = (data?.data ?? {}) as { categories?: CategoryDef[]; prefs?: Partial<Prefs> }
  const remote = remoteData.categories ?? []
  if (settingsSync.merge) {
    // первый вход: облачные категории + свои локальные, которых там нет
    const local = getCategories()
    const merged = [...remote, ...local.filter((c) => !remote.some((r) => r.id === c.id))]
    applyRemoteCategories(merged.length ? merged : DEFAULT_CATEGORIES)
    if (remoteData.prefs) applyRemotePrefs(remoteData.prefs)
    setSettingsSync({ merge: false, dirty: merged.length !== remote.length || !remoteData.prefs })
  } else if (!settingsSync.dirty) {
    if (remote.length) applyRemoteCategories(remote)
    if (remoteData.prefs) applyRemotePrefs(remoteData.prefs)
  }
}

async function flush(session: Session) {
  await flushSettings(session)
  for (const c of collections) await c.flush(session)
}

let running: Promise<void> | null = null
export function sync(): Promise<void> {
  const session = st.session
  if (!session) return Promise.resolve()
  if (running) return running.then(() => sync())
  set({ status: 'syncing' })
  running = (async () => {
    try {
      await flush(session)
      for (const c of collections) await c.pull()
      await pullSettings()
      if (settingsSync.dirty) await flushSettings(session)
      set({ status: 'synced', lastSync: Date.now() })
    } catch (e) {
      set({ status: navigator.onLine ? 'error' : 'offline' })
      console.warn('sync failed', e)
    } finally {
      running = null
    }
  })()
  return running
}

// ——— сессия ———

function onSession(session: Session | null) {
  const prev = st.session?.user.id
  set({ session, ready: true, status: session ? st.status : 'local' })
  if (!session || prev === session.user.id) return

  const owner = read<string | null>(OWNER_KEY, null)
  if (owner !== session.user.id) {
    for (const c of collections) {
      // на устройстве чужие данные (не должно случаться: при выходе чистим) — начинаем с чистого листа;
      // первый вход — созданное без аккаунта переезжает в аккаунт
      if (owner) c.reset()
      else c.adoptLocal()
    }
    write(OWNER_KEY, JSON.stringify(session.user.id))
    if (owner) {
      resetCategories()
      resetPrefs()
    }
    setSettingsSync({ dirty: false, merge: true })
  }
  void sync().then(() => {
    if (getPrefs().notifications && 'Notification' in window && Notification.permission === 'granted') void subscribePush()
  })
}

export function initSync() {
  if (!supabaseConfigured) return
  onLocalChange((c) => tasksSync.enqueue(c.type === 'upsert' ? c.task.id : c.id, c.type === 'upsert' ? c.task : null))
  onIncomeChange((c) => incomeSync.enqueue(c.type === 'upsert' ? c.item.id : c.id, c.type === 'upsert' ? c.item : null))
  const settingsChanged = () => {
    if (!st.session) return
    setSettingsSync({ dirty: true })
    scheduleFlush()
  }
  onCategoriesChange(settingsChanged)
  onPrefsChange(settingsChanged)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') set({ recovery: true })
    // колбэк не должен ждать запросов к Supabase — откладываем
    setTimeout(() => onSession(session), 0)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync()
  })
  window.addEventListener('online', () => void sync())
  setInterval(() => {
    if (document.visibilityState === 'visible') void sync()
  }, 60_000)
}

// ——— вход и выход ———

const ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, 'Неверная почта или пароль'],
  [/already registered|already exists/i, 'Такой аккаунт уже есть — войди'],
  [/password should be|weak password|password.*(characters|contain)/i, 'Пароль слабоват: минимум 8 символов, буквы и цифры'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'Проверь адрес почты'],
  [/rate limit|too many/i, 'Слишком много попыток — подожди пару минут'],
  [/email not confirmed/i, 'Почта не подтверждена — проверь письмо'],
  [/fetch|network/i, 'Нет связи с сервером — проверь интернет'],
]

function humanize(message: string): string {
  return ERRORS.find(([re]) => re.test(message))?.[1] ?? message
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? humanize(error.message) : null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
  if (error) return humanize(error.message)
  // при включённом подтверждении почты сессии ещё нет
  if (!data.session) return 'Мы отправили письмо — подтверди почту и войди'
  return null
}

export async function resetPassword(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname })
  return error ? humanize(error.message) : null
}

export async function updatePassword(password: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return humanize(error.message)
  set({ recovery: false })
  return null
}

export async function signOut() {
  await unsubscribePush() // уведомления этого аккаунта на устройство больше не нужны
  try {
    if (st.session) await flush(st.session)
  } catch {
    // не отправилось — всё равно выходим; правки без сети потеряются, предупреждаем в интерфейсе
  }
  await supabase.auth.signOut()
  for (const c of collections) c.reset()
  write(OWNER_KEY, null)
  write(SETTINGS_KEY, null)
  settingsSync = { dirty: false, merge: false }
  resetCategories()
  resetPrefs()
  skipAuth(false)
  set({ session: null, status: 'local', lastSync: null })
}

export const pendingCount = () => collections.reduce((n, c) => n + c.count(), 0)

// «Пока без аккаунта» — помним выбор, чтобы не показывать экран входа каждый раз
export const authSkipped = () => read<boolean>(SKIP_KEY, false)
export const skipAuth = (v: boolean) => write(SKIP_KEY, v ? 'true' : null)

import { useSyncExternalStore } from 'react'

// Настройки пользователя. С аккаунтом синхронизируются вместе с категориями (таблица settings).

export interface Prefs {
  /** сетка дня: первый и последний час */
  dayStart: number
  dayEnd: number
  /** уведомления включены */
  notifications: boolean
  /** за сколько минут напоминать по умолчанию; null — не напоминать */
  defaultRemind: number | null
  /** утренний план дня */
  morningPlan: boolean
  /** время утреннего плана, минуты от полуночи */
  morningTime: number
}

export const DEFAULT_PREFS: Prefs = {
  dayStart: 8,
  dayEnd: 18,
  notifications: false,
  defaultRemind: 10,
  morningPlan: false,
  morningTime: 8 * 60,
}

export const REMIND_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'не напоминать' },
  { value: 0, label: 'в момент начала' },
  { value: 5, label: 'за 5 минут' },
  { value: 10, label: 'за 10 минут' },
  { value: 15, label: 'за 15 минут' },
  { value: 30, label: 'за 30 минут' },
  { value: 60, label: 'за час' },
  { value: 120, label: 'за 2 часа' },
  { value: 1440, label: 'за день' },
]

export const remindLabel = (v: number | null) => REMIND_OPTIONS.find((o) => o.value === v)?.label ?? `за ${v} мин`

const KEY = 'planner.prefs'

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    // повреждённые данные — по умолчанию
  }
  return DEFAULT_PREFS
}

let prefs = load()
const listeners = new Set<() => void>()
let changeListener: (() => void) | null = null

function save(next: Prefs, notify: boolean) {
  prefs = next
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // работаем в памяти
  }
  listeners.forEach((l) => l())
  if (notify) changeListener?.()
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
}

export const getPrefs = () => prefs
export const setPrefs = (patch: Partial<Prefs>) => save({ ...prefs, ...patch }, true)
export const onPrefsChange = (fn: (() => void) | null) => {
  changeListener = fn
}
export const applyRemotePrefs = (p: Partial<Prefs>) => save({ ...DEFAULT_PREFS, ...p }, false)
export const resetPrefs = () => save(DEFAULT_PREFS, false)

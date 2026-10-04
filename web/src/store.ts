import { useSyncExternalStore } from 'react'
import { daysBetween, todayKey, weekday } from './dates'

/** id категории (см. categories.ts) */
export type Category = string
export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly'

export const REPEATS: { id: Repeat; label: string }[] = [
  { id: 'none', label: 'никогда' },
  { id: 'daily', label: 'каждый день' },
  { id: 'weekdays', label: 'по будням' },
  { id: 'weekly', label: 'каждую неделю' },
]

export interface Task {
  id: string
  title: string
  note: string
  category: Category
  /** 'YYYY-MM-DD'; для повторяющихся — дата первого раза */
  date: string | null
  /** минуты от полуночи; null — «без времени» */
  start: number | null
  /** минуты */
  duration: number
  repeat: Repeat
  /** для разовых дел */
  done: boolean
  /** для повторяющихся — дни, в которые дело сделано */
  doneDates: string[]
  createdAt: number
}

export type TaskDraft = Omit<Task, 'id' | 'done' | 'doneDates' | 'createdAt'>

interface State {
  tasks: Task[]
}

const STORAGE_KEY = 'planner.v1'

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data.tasks)) return { tasks: data.tasks }
    }
  } catch {
    // повреждённые данные или недоступное хранилище — начинаем с пустого
  }
  return { tasks: [] }
}

let state: State = load()
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // приватный режим и т.п. — работаем в памяти
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, () => state.tasks)
}

// ——— изменения для синхронизации ———
export type Change = { type: 'upsert'; task: Task } | { type: 'delete'; id: string }
let changeListener: ((c: Change) => void) | null = null
/** Синхронизация подписывается на локальные изменения */
export function onLocalChange(fn: ((c: Change) => void) | null) {
  changeListener = fn
}

export function getTasks(): Task[] {
  return state.tasks
}

/** Изменения с сервера: без уведомления синхронизации (иначе отправим их обратно) */
export function applyRemote(upserts: Task[], deletes: string[]) {
  if (!upserts.length && !deletes.length) return
  const byId = new Map(state.tasks.map((t) => [t.id, t]))
  for (const id of deletes) byId.delete(id)
  for (const t of upserts) byId.set(t.id, t)
  setState({ tasks: [...byId.values()] })
}

/** Выход из аккаунта: дела остаются на сервере, с устройства убираем */
export function clearLocal() {
  setState({ tasks: [] })
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function addTask(draft: TaskDraft): Task {
  const task: Task = { ...draft, id: newId(), done: false, doneDates: [], createdAt: Date.now() }
  setState({ tasks: [...state.tasks, task] })
  changeListener?.({ type: 'upsert', task })
  return task
}

export function updateTask(id: string, patch: Partial<Task>) {
  setState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  const task = state.tasks.find((t) => t.id === id)
  if (task) changeListener?.({ type: 'upsert', task })
}

export function deleteTask(id: string) {
  setState({ tasks: state.tasks.filter((t) => t.id !== id) })
  changeListener?.({ type: 'delete', id })
}

/** Отметить/снять «сделано». Для повторяющихся — только в указанный день. */
export function toggleDone(id: string, day: string) {
  const t = state.tasks.find((x) => x.id === id)
  if (!t) return
  if (t.repeat === 'none') {
    updateTask(id, { done: !t.done })
  } else {
    const has = t.doneDates.includes(day)
    updateTask(id, { doneDates: has ? t.doneDates.filter((d) => d !== day) : [...t.doneDates, day] })
  }
}

// ——— правила расписания ———

export function occursOn(t: Task, day: string): boolean {
  if (!t.date) return false
  if (t.repeat === 'none') return t.date === day
  if (daysBetween(t.date, day) < 0) return false
  const wd = weekday(day)
  if (t.repeat === 'daily') return true
  if (t.repeat === 'weekdays') return wd >= 1 && wd <= 5
  return wd === weekday(t.date)
}

export function isDoneOn(t: Task, day: string): boolean {
  return t.repeat === 'none' ? t.done : t.doneDates.includes(day)
}

export function isOverdue(t: Task, today = todayKey()): boolean {
  return t.repeat === 'none' && !t.done && !!t.date && daysBetween(t.date, today) > 0
}

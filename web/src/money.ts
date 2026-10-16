import { useSyncExternalStore } from 'react'
import { COLORS, type ColorName } from './categories'

// Заработок: дата, источник, сумма. Хранится так же, как дела: localStorage + синхронизация (sync.ts).

export interface Income {
  id: string
  /** 'YYYY-MM-DD' */
  date: string
  /** откуда пришли деньги — свободный текст */
  source: string
  /** в рублях */
  amount: number
  note: string
  createdAt: number
}

export type IncomeDraft = Omit<Income, 'id' | 'createdAt'>

const STORAGE_KEY = 'planner.money'

function load(): Income[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data.items)) return data.items
    }
  } catch {
    // повреждённые данные — начинаем с пустого
  }
  return []
}

let items: Income[] = load()
const listeners = new Set<() => void>()

function setItems(next: Income[]) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }))
  } catch {
    // нет хранилища — работаем в памяти
  }
  listeners.forEach((l) => l())
}

export function useIncome(): Income[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}

export const getIncome = () => items

// ——— изменения для синхронизации ———
export type IncomeChange = { type: 'upsert'; item: Income } | { type: 'delete'; id: string }
let changeListener: ((c: IncomeChange) => void) | null = null
export function onIncomeChange(fn: ((c: IncomeChange) => void) | null) {
  changeListener = fn
}

/** Изменения с сервера: без уведомления синхронизации */
export function applyRemoteIncome(upserts: Income[], deletes: string[]) {
  if (!upserts.length && !deletes.length) return
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const id of deletes) byId.delete(id)
  for (const i of upserts) byId.set(i.id, i)
  setItems([...byId.values()])
}

export function clearLocalIncome() {
  setItems([])
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function addIncome(draft: IncomeDraft): Income {
  const item: Income = { ...draft, id: newId(), createdAt: Date.now() }
  setItems([...items, item])
  changeListener?.({ type: 'upsert', item })
  return item
}

export function updateIncome(id: string, patch: Partial<IncomeDraft>) {
  setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const item = items.find((i) => i.id === id)
  if (item) changeListener?.({ type: 'upsert', item })
}

export function deleteIncome(id: string) {
  setItems(items.filter((i) => i.id !== id))
  changeListener?.({ type: 'delete', id })
}

// ——— подсчёты ———

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
export const formatMoney = (n: number) => money.format(n) + ' ₽'

/** Разбор суммы из поля ввода: «12 500,50» → 12500.5 */
export function parseAmount(s: string): number | null {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

export const sum = (list: Income[]) => Math.round(list.reduce((s, i) => s + i.amount, 0) * 100) / 100

/** Источники по убыванию общей суммы (за всё время) */
export function sourcesByTotal(list: Income[]): string[] {
  const totals = new Map<string, number>()
  for (const i of list) totals.set(i.source, (totals.get(i.source) ?? 0) + i.amount)
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
}

/** Цвет источника: по месту в списке источников, чтобы у крупных были разные цвета */
export function sourceColor(source: string, ordered: string[]): ColorName {
  const i = ordered.indexOf(source)
  return COLORS[(i < 0 ? 0 : i) % (COLORS.length - 1)] // серый оставляем для «прочих»
}

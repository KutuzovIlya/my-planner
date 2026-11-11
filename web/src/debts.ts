import { useSyncExternalStore } from 'react'
import type { Income } from './money'

// Должники: кто, сколько должен и с какого дня. Возвраты — это обычные поступления в «Деньгах»
// с пометкой debtId, поэтому они и в итогах за месяц, и в долге («отдал 10 000 из 100 000»).

export interface Debt {
  id: string
  /** кто должен */
  name: string
  /** сколько всего был должен, в рублях */
  amount: number
  /** 'YYYY-MM-DD' — когда дал в долг */
  date: string
  note: string
  createdAt: number
}

export type DebtDraft = Omit<Debt, 'id' | 'createdAt'>

const STORAGE_KEY = 'planner.debts'

function load(): Debt[] {
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

let items: Debt[] = load()
const listeners = new Set<() => void>()

function setItems(next: Debt[]) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }))
  } catch {
    // нет хранилища — работаем в памяти
  }
  listeners.forEach((l) => l())
}

export function useDebts(): Debt[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}

export const getDebts = () => items

export type DebtChange = { type: 'upsert'; item: Debt } | { type: 'delete'; id: string }
let changeListener: ((c: DebtChange) => void) | null = null
export function onDebtChange(fn: ((c: DebtChange) => void) | null) {
  changeListener = fn
}

export function applyRemoteDebts(upserts: Debt[], deletes: string[]) {
  if (!upserts.length && !deletes.length) return
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const id of deletes) byId.delete(id)
  for (const i of upserts) byId.set(i.id, i)
  setItems([...byId.values()])
}

export function clearLocalDebts() {
  setItems([])
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function addDebt(draft: DebtDraft): Debt {
  const item: Debt = { ...draft, id: newId(), createdAt: Date.now() }
  setItems([...items, item])
  changeListener?.({ type: 'upsert', item })
  return item
}

export function updateDebt(id: string, patch: Partial<DebtDraft>) {
  setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const item = items.find((i) => i.id === id)
  if (item) changeListener?.({ type: 'upsert', item })
}

export function deleteDebt(id: string) {
  setItems(items.filter((i) => i.id !== id))
  changeListener?.({ type: 'delete', id })
}

// ——— подсчёты ———

const round = (n: number) => Math.round(n * 100) / 100

export const paymentsOf = (d: Debt, income: Income[]) => income.filter((i) => i.debtId === d.id)
export const paidOf = (d: Debt, income: Income[]) => round(paymentsOf(d, income).reduce((s, i) => s + i.amount, 0))
export const leftOf = (d: Debt, income: Income[]) => Math.max(0, round(d.amount - paidOf(d, income)))

/** Сначала те, кто ещё должен (больший остаток выше), потом закрытые */
export function sortDebts(list: Debt[], income: Income[]): Debt[] {
  return [...list].sort((a, b) => {
    const la = leftOf(a, income)
    const lb = leftOf(b, income)
    if (!la !== !lb) return la ? -1 : 1
    return lb - la || b.createdAt - a.createdAt
  })
}

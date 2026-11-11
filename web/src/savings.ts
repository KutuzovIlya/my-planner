import { useSyncExternalStore } from 'react'

// Копилка: сколько и когда отложил. Видна только в шторке «Копилка», в итоги «Денег» не входит.

export interface Saving {
  id: string
  /** в рублях */
  amount: number
  /** 'YYYY-MM-DD' */
  date: string
  note: string
  createdAt: number
}

export type SavingDraft = Omit<Saving, 'id' | 'createdAt'>

const STORAGE_KEY = 'planner.savings'

function load(): Saving[] {
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

let items: Saving[] = load()
const listeners = new Set<() => void>()

function setItems(next: Saving[]) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }))
  } catch {
    // нет хранилища — работаем в памяти
  }
  listeners.forEach((l) => l())
}

export function useSavings(): Saving[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}

export const getSavings = () => items

export type SavingChange = { type: 'upsert'; item: Saving } | { type: 'delete'; id: string }
let changeListener: ((c: SavingChange) => void) | null = null
export function onSavingChange(fn: ((c: SavingChange) => void) | null) {
  changeListener = fn
}

export function applyRemoteSavings(upserts: Saving[], deletes: string[]) {
  if (!upserts.length && !deletes.length) return
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const id of deletes) byId.delete(id)
  for (const i of upserts) byId.set(i.id, i)
  setItems([...byId.values()])
}

export function clearLocalSavings() {
  setItems([])
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function addSaving(draft: SavingDraft): Saving {
  const item: Saving = { ...draft, id: newId(), createdAt: Date.now() }
  setItems([...items, item])
  changeListener?.({ type: 'upsert', item })
  return item
}

export function updateSaving(id: string, patch: Partial<SavingDraft>) {
  setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const item = items.find((i) => i.id === id)
  if (item) changeListener?.({ type: 'upsert', item })
}

export function deleteSaving(id: string) {
  setItems(items.filter((i) => i.id !== id))
  changeListener?.({ type: 'delete', id })
}

export const savedTotal = (list: Saving[]) => Math.round(list.reduce((s, i) => s + i.amount, 0) * 100) / 100

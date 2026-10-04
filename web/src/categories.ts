import { useSyncExternalStore } from 'react'

// Категории: 4 стандартные + свои. Цвет — из готовой палитры (светлая и тёмная тема в CSS: .cc-<цвет>).

export const COLORS = ['blue', 'purple', 'green', 'orange', 'red', 'pink', 'teal', 'yellow', 'indigo', 'brown', 'gray'] as const
export type ColorName = (typeof COLORS)[number]

export interface CategoryDef {
  id: string
  label: string
  color: ColorName
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'work', label: 'работа', color: 'blue' },
  { id: 'personal', label: 'личное', color: 'purple' },
  { id: 'health', label: 'здоровье', color: 'green' },
  { id: 'home', label: 'дом', color: 'orange' },
]

const KEY = 'planner.categories'

interface State {
  list: CategoryDef[]
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data.list) && data.list.length) return { list: data.list }
    }
  } catch {
    // повреждённые данные — стандартные категории
  }
  return { list: DEFAULT_CATEGORIES }
}

let state = load()
const listeners = new Set<() => void>()
let changeListener: (() => void) | null = null

function setState(next: State, notify = true) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // работаем в памяти
  }
  listeners.forEach((l) => l())
  if (notify) changeListener?.()
}

export function useCategories(): CategoryDef[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state.list,
  )
}

export const getCategories = () => state.list

/** Синхронизация подписывается на изменения категорий */
export function onCategoriesChange(fn: (() => void) | null) {
  changeListener = fn
}

/** Категории с сервера — без уведомления синхронизации */
export function applyRemoteCategories(list: CategoryDef[]) {
  if (list.length) setState({ list }, false)
}

export function resetCategories() {
  setState({ list: DEFAULT_CATEGORIES }, false)
}

export function addCategory(label: string, color: ColorName): CategoryDef {
  const cat: CategoryDef = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), label: label.trim(), color }
  setState({ list: [...state.list, cat] })
  return cat
}

export function updateCategory(id: string, patch: Partial<Omit<CategoryDef, 'id'>>) {
  setState({ list: state.list.map((c) => (c.id === id ? { ...c, ...patch, label: (patch.label ?? c.label).trim() } : c)) })
}

export function deleteCategory(id: string) {
  setState({ list: state.list.filter((c) => c.id !== id) })
}

const find = (id: string) => state.list.find((c) => c.id === id)

/** Подпись категории; у удалённой — «без категории» */
export const categoryLabel = (id: string) => find(id)?.label ?? 'без категории'

/** CSS-класс цвета категории (задаёт --c, --c-bg, --c-fg, --c-sub) */
export const catClass = (id: string) => 'cc-' + (find(id)?.color ?? 'gray')

/** Следующий свободный цвет для новой категории */
export function nextColor(): ColorName {
  const used = new Set(state.list.map((c) => c.color))
  return COLORS.find((c) => !used.has(c)) ?? 'gray'
}

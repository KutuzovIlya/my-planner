import type { ReactNode } from 'react'
import { Calendar, Clock, Gear, ListChecks } from '../icons'

export type Tab = 'today' | 'week' | 'tasks' | 'settings'

const TABS: { id: Tab; label: string; icon: () => ReactNode }[] = [
  { id: 'today', label: 'Сегодня', icon: () => <Clock /> },
  { id: 'week', label: 'Неделя', icon: () => <Calendar /> },
  { id: 'tasks', label: 'Задачи', icon: () => <ListChecks /> },
  { id: 'settings', label: 'Настройки', icon: () => <Gear /> },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={'tab' + (t.id === tab ? ' active' : '')} onClick={() => onChange(t.id)} aria-current={t.id === tab}>
          {t.icon()}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

import type { ReactNode } from 'react'
import { Clock, ListChecks } from '../icons'

export type Tab = 'today' | 'tasks'

const TABS: { id: Tab; label: string; icon: () => ReactNode }[] = [
  { id: 'today', label: 'Сегодня', icon: () => <Clock /> },
  { id: 'tasks', label: 'Задачи', icon: () => <ListChecks /> },
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

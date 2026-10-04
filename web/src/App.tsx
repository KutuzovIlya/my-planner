import { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { AccountSheet } from './components/AccountSheet'
import { AuthForm } from './components/AuthForm'
import { AuthScreen } from './components/AuthScreen'
import { SearchSheet } from './components/SearchSheet'
import { TaskForm } from './components/TaskForm'
import { todayKey } from './dates'
import { Settings } from './screens/Settings'
import { Tasks } from './screens/Tasks'
import { Today } from './screens/Today'
import { Week } from './screens/Week'
import { useCategories } from './categories'
import { useTasks, type TaskDraft } from './store'
import { supabaseConfigured } from './supabase'
import { authSkipped, useSync } from './sync'

type Sheet = { kind: 'account' } | { kind: 'search' } | { kind: 'new'; initial?: Partial<TaskDraft> } | { kind: 'edit'; id: string; day?: string } | null

const tabFromHash = (): Tab => {
  const h = location.hash.slice(1)
  return h === 'tasks' || h === 'week' || h === 'settings' ? h : 'today'
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [day, setDay] = useState(todayKey)
  const [sheet, setSheet] = useState<Sheet>(null)
  const tasks = useTasks()
  const auth = useSync()
  useCategories() // перерисовать всё при переименовании/перекраске категории
  const [skipped, setSkipped] = useState(authSkipped)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const changeTab = (t: Tab) => {
    // повторное нажатие на «Сегодня» возвращает к текущему дню
    if (t === 'today' && tab === 'today') setDay(todayKey())
    setTab(t)
    history.replaceState(null, '', t === 'today' ? location.pathname : '#' + t)
  }

  if (supabaseConfigured && !auth.ready) return <div className="app" />
  if (supabaseConfigured && !auth.session && !skipped && !auth.recovery) {
    return (
      <div className="app">
        <AuthScreen onSkip={() => setSkipped(true)} />
      </div>
    )
  }

  const editing = sheet?.kind === 'edit' ? tasks.find((t) => t.id === sheet.id) : undefined
  const close = () => setSheet(null)

  return (
    <div className={'app' + (tab === 'today' ? ' white' : '')}>
      {tab === 'today' && (
        <Today
          day={day}
          onDayChange={setDay}
          onEdit={(t, d) => setSheet({ kind: 'edit', id: t.id, day: d })}
          onNew={(initial) => setSheet({ kind: 'new', initial })}
          onSearch={() => setSheet({ kind: 'search' })}
        />
      )}
      {tab === 'week' && (
        <Week
          day={day}
          onSearch={() => setSheet({ kind: 'search' })}
          onOpenDay={(d) => {
            setDay(d)
            changeTab('today')
          }}
        />
      )}
      {tab === 'tasks' && (
        <Tasks onEdit={(t) => setSheet({ kind: 'edit', id: t.id })} onNew={() => setSheet({ kind: 'new' })} />
      )}
      {tab === 'settings' && <Settings onAccount={() => setSheet({ kind: 'account' })} />}
      <TabBar tab={tab} onChange={changeTab} />

      {sheet?.kind === 'account' && <AccountSheet onClose={close} />}
      {auth.recovery && (
        <div className="sheet-scrim">
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Новый пароль">
            <div className="sheet-head"><span /><h2>Новый пароль</h2><span /></div>
            <div className="sheet-body"><AuthForm initialMode="newpass" /></div>
          </div>
        </div>
      )}
      {sheet?.kind === 'search' && (
        <SearchSheet
          onClose={close}
          onEdit={(t) => setSheet({ kind: 'edit', id: t.id })}
          onOpenDay={(d) => {
            setSheet(null)
            setDay(d)
            changeTab('today')
          }}
        />
      )}
      {sheet?.kind === 'new' && <TaskForm initial={sheet.initial} onClose={close} />}
      {editing && sheet?.kind === 'edit' && <TaskForm key={editing.id} task={editing} day={sheet.day} onClose={close} />}
    </div>
  )
}

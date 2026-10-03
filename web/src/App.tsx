import { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { TaskForm } from './components/TaskForm'
import { Tasks } from './screens/Tasks'
import { Today } from './screens/Today'
import { useTasks, type TaskDraft } from './store'

type Sheet = { kind: 'new'; initial?: Partial<TaskDraft> } | { kind: 'edit'; id: string; day?: string } | null

const tabFromHash = (): Tab => (location.hash === '#tasks' ? 'tasks' : 'today')

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [sheet, setSheet] = useState<Sheet>(null)
  const tasks = useTasks()

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const changeTab = (t: Tab) => {
    setTab(t)
    history.replaceState(null, '', t === 'today' ? location.pathname : '#tasks')
  }

  const editing = sheet?.kind === 'edit' ? tasks.find((t) => t.id === sheet.id) : undefined
  const close = () => setSheet(null)

  return (
    <div className={'app' + (tab === 'today' ? ' white' : '')}>
      {tab === 'today' ? (
        <Today onEdit={(t, day) => setSheet({ kind: 'edit', id: t.id, day })} onNew={(initial) => setSheet({ kind: 'new', initial })} />
      ) : (
        <Tasks onEdit={(t) => setSheet({ kind: 'edit', id: t.id })} onNew={() => setSheet({ kind: 'new' })} />
      )}
      <TabBar tab={tab} onChange={changeTab} />

      {sheet?.kind === 'new' && <TaskForm initial={sheet.initial} onClose={close} />}
      {editing && sheet?.kind === 'edit' && <TaskForm key={editing.id} task={editing} day={sheet.day} onClose={close} />}
    </div>
  )
}

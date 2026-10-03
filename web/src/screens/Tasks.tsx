import { useState } from 'react'
import { QuickAdd } from '../components/QuickAdd'
import { daysBetween, formatDay, formatRelative, formatTime, todayKey } from '../dates'
import { Check, Plus, Repeat, Search } from '../icons'
import { categoryLabel, isDoneOn, occursOn, REPEATS, toggleDone, useTasks, type Task } from '../store'

type GroupId = 'overdue' | 'today' | 'week' | 'later' | 'nodate' | 'regular' | 'done'

const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'overdue', label: 'Просрочено' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Ближайшие 7 дней' },
  { id: 'later', label: 'Позже' },
  { id: 'nodate', label: 'Без срока' },
  { id: 'regular', label: 'Регулярные' },
  { id: 'done', label: 'Выполнено' },
]

function groupOf(t: Task, today: string): GroupId {
  if (t.repeat !== 'none') return occursOn(t, today) ? 'today' : 'regular'
  if (t.done) return 'done'
  if (!t.date) return 'nodate'
  const diff = daysBetween(today, t.date)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return diff <= 7 ? 'week' : 'later'
}

function meta(t: Task, group: GroupId, today: string): string {
  const parts: string[] = []
  if (t.repeat !== 'none') {
    parts.push(REPEATS.find((r) => r.id === t.repeat)!.label)
  } else if (t.date && group !== 'today') {
    parts.push(group === 'overdue' ? formatDay(t.date) : formatRelative(t.date, today))
  }
  if (t.start !== null) parts.push(formatTime(t.start))
  else if (group === 'today') parts.push('без времени')
  parts.push(categoryLabel(t.category))
  return parts.join(' · ')
}

const sortKey = (t: Task) => `${t.date ?? '9999'}-${String(t.start ?? 9999).padStart(4, '0')}-${t.createdAt}`

export function Tasks({ onEdit, onNew }: { onEdit: (t: Task) => void; onNew: () => void }) {
  const tasks = useTasks()
  const today = todayKey()
  const [query, setQuery] = useState('')
  const [showDone, setShowDone] = useState(false)

  const q = query.trim().toLowerCase()
  const visible = q ? tasks.filter((t) => (t.title + ' ' + t.note).toLowerCase().includes(q)) : tasks

  const grouped = new Map<GroupId, Task[]>()
  for (const t of visible) {
    const g = groupOf(t, today)
    grouped.set(g, [...(grouped.get(g) ?? []), t])
  }

  return (
    <>
      <header className="header">
        <div className="header-row">
          <div className="title">Задачи</div>
          <button className="icon-btn" onClick={onNew} aria-label="Новое дело"><Plus /></button>
        </div>
        <label className="search">
          <Search />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск" />
        </label>
      </header>

      <div className="scroll">
        {tasks.length === 0 ? (
          <div className="empty">
            <b>Здесь будут все дела</b>
            Напиши первое в строке внизу — например, «Позвонить в банк завтра в 10 #работа».
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">Ничего не найдено</div>
        ) : (
          <div className="task-list">
            {GROUPS.map(({ id, label }) => {
              const items = (grouped.get(id) ?? []).sort((a, b) => (id === 'done' ? b.createdAt - a.createdAt : sortKey(a).localeCompare(sortKey(b))))
              if (!items.length) return null
              const collapsed = id === 'done' && !showDone && !q
              return (
                <section key={id} className="section">
                  <div className={'section-title' + (id === 'overdue' ? ' red' : '')}>
                    <span>{label} · {items.length}</span>
                    {id === 'done' && !q && (
                      <button className="link-btn" onClick={() => setShowDone(!showDone)}>{showDone ? 'Скрыть' : 'Показать'}</button>
                    )}
                  </div>
                  {!collapsed && (
                    <div className="group">
                      {items.map((t) => {
                        const done = t.repeat === 'none' ? t.done : isDoneOn(t, today)
                        const canCheck = id !== 'regular'
                        return (
                          <div key={t.id} className={`row cat-${t.category}` + (done ? ' done' : '')}>
                            {canCheck ? (
                              <button
                                className={'check' + (done ? ' on' : '') + (id === 'overdue' ? ' red' : '')}
                                onClick={() => toggleDone(t.id, today)}
                                aria-label={done ? 'Снять отметку' : 'Отметить выполненным'}
                                aria-pressed={done}
                              >
                                {done && <Check />}
                              </button>
                            ) : (
                              <span className="check" style={{ border: 0, color: 'var(--label-3)' }}><Repeat /></span>
                            )}
                            <button className="row-body" style={{ textAlign: 'left' }} onClick={() => onEdit(t)}>
                              <span className="row-title">{t.title}</span>
                              <span className="row-meta">{meta(t, id, today)}</span>
                            </button>
                            <span className="dot" style={{ width: 8, height: 8 }} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>

      <QuickAdd />
    </>
  )
}

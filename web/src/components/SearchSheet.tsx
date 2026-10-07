import { useEffect, useState } from 'react'
import { addDays, daysBetween, formatDay, formatLong, formatTime, todayKey } from '../dates'
import { Repeat, Search } from '../icons'
import { catClass, categoryLabel } from '../categories'
import { isDoneOn, occursOn, REPEATS, type Task, useTasks } from '../store'

/** Ближайший день, когда дело запланировано (для повторяющихся — следующий раз с сегодня) */
export function nextOccurrence(t: Task, today: string): string | null {
  if (!t.date) return null
  if (t.repeat === 'none') return t.date
  const from = daysBetween(t.date, today) > 0 ? today : t.date
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i)
    if (occursOn(t, d)) return d
  }
  // период закончился — показываем его последний день
  return t.until ?? t.date
}

/** Поиск дела по названию → переход к его дню */
export function SearchSheet({ onOpenDay, onEdit, onClose }: {
  onOpenDay: (day: string) => void
  onEdit: (t: Task) => void
  onClose: () => void
}) {
  const tasks = useTasks()
  const today = todayKey()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const q = query.trim().toLowerCase()
  const found = q
    ? tasks
        .filter((t) => (t.title + ' ' + t.note).toLowerCase().includes(q))
        .map((t) => ({ t, day: nextOccurrence(t, today) }))
        .sort((a, b) => {
          // сначала ближайшие будущие, потом прошедшие (свежие выше), потом без даты
          const rank = (d: string | null) => (d === null ? 2 : daysBetween(today, d) >= 0 ? 0 : 1)
          const ra = rank(a.day)
          const rb = rank(b.day)
          if (ra !== rb) return ra - rb
          if (!a.day || !b.day) return a.t.createdAt - b.t.createdAt
          return ra === 0 ? a.day.localeCompare(b.day) : b.day.localeCompare(a.day)
        })
    : []

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Поиск дела" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head search-head">
          <label className="search" style={{ flex: 1 }}>
            <Search />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название дела"
              autoFocus
              enterKeyHint="search"
            />
          </label>
          <button onClick={onClose} style={{ minWidth: 0, fontWeight: 400 }}>Отмена</button>
        </div>

        <div className="sheet-body" style={{ gap: 0 }}>
          {!q ? (
            <div className="empty">Напиши, что ищешь — покажу, в какой день это дело</div>
          ) : found.length === 0 ? (
            <div className="empty">Ничего не найдено</div>
          ) : (
            <div className="group">
              {found.map(({ t, day }) => {
                const done = day ? isDoneOn(t, day) : t.done
                const past = day && daysBetween(today, day) < 0
                const when = day
                  ? (t.repeat !== 'none' ? 'ближайший раз: ' : '') + formatLong(day)
                  : 'без даты'
                const meta = [
                  t.repeat !== 'none' ? REPEATS.find((r) => r.id === t.repeat)!.label + (t.until ? ` по ${formatDay(t.until)}` : '') : null,
                  t.start !== null ? formatTime(t.start) : null,
                  categoryLabel(t.category),
                ].filter(Boolean).join(' · ')
                return (
                  <button
                    key={t.id}
                    className={`row ${catClass(t.category)}` + (done ? ' done' : '')}
                    onClick={() => (day ? onOpenDay(day) : onEdit(t))}
                  >
                    <span className="dot" style={{ width: 8, height: 8, marginLeft: 7, marginRight: 7 }} />
                    <span className="row-body">
                      <span className="row-title">{t.title}</span>
                      <span className="row-meta" style={{ color: past && !done ? 'var(--red)' : undefined }}>
                        {t.repeat !== 'none' && <Repeat size={11} />} {when}
                      </span>
                      <span className="row-meta">{meta}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

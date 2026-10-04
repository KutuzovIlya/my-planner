import { useState } from 'react'
import { usePager } from '../components/usePager'
import { addDays, formatDuration, formatRange, fromKey, todayKey, WEEKDAYS, weekday, weekStart } from '../dates'
import { ChevronLeft, ChevronRight, Search } from '../icons'
import { catClass } from '../categories'
import { occursOn, useTasks, type Task } from '../store'

/** Сколько минут в дне считаем «полной загрузкой» для полоски */
const DAY_CAPACITY = 10 * 60

function byTime(a: Task, b: Task) {
  return (a.start ?? 24 * 60) - (b.start ?? 24 * 60) || a.createdAt - b.createdAt
}

export function Week({ day, onOpenDay, onSearch }: { day: string; onOpenDay: (day: string) => void; onSearch: () => void }) {
  const tasks = useTasks()
  const today = todayKey()
  const [start, setStart] = useState(() => weekStart(day))
  const [slide, setSlide] = useState<'left' | 'right' | null>(null)

  const go = (next: string) => {
    if (next === start) return
    setSlide(next > start ? 'left' : 'right')
    setStart(next)
  }
  const { handlers, pageStyle } = usePager((dir) => go(addDays(start, dir * 7)))

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const isThisWeek = start === weekStart(today)

  return (
    <div className="pager" {...handlers}>
      <header className="header">
        <div className="header-row">
          <div>
            <div className="title">Неделя</div>
            <div className="subtitle">
              <span>{formatRange(days[0], days[6])}</span>
              {!isThisWeek && (
                <button className="today-pill" onClick={() => go(weekStart(today))}>к этой неделе</button>
              )}
            </div>
          </div>
          <div className="day-nav">
            <button className="icon-btn" onClick={onSearch} aria-label="Найти дело"><Search size={21} /></button>
            <button className="icon-btn" onClick={() => go(addDays(start, -7))} aria-label="Предыдущая неделя"><ChevronLeft /></button>
            <button className="icon-btn" onClick={() => go(addDays(start, 7))} aria-label="Следующая неделя"><ChevronRight /></button>
          </div>
        </div>
      </header>

      <div key={start} className={'pager-page week-page' + (slide ? ' slide-' + slide : '')} style={pageStyle}>
        <div className="scroll">
          <div className="week-list">
            {days.map((d) => {
              const items = tasks.filter((t) => occursOn(t, d)).sort(byTime)
              const timed = items.filter((t) => t.start !== null)
              const total = timed.reduce((sum, t) => sum + t.duration, 0)

              // сегменты полоски: минуты по категориям в порядке появления в дне
              const segments: { category: Task['category']; minutes: number }[] = []
              for (const t of timed) {
                const last = segments[segments.length - 1]
                if (last?.category === t.category) last.minutes += t.duration
                else segments.push({ category: t.category, minutes: t.duration })
              }
              const free = Math.max(0, DAY_CAPACITY - total)
              const name = WEEKDAYS[weekday(d)]
              const isToday = d === today

              return (
                <button key={d} className={'week-day' + (isToday ? ' today' : '')} onClick={() => onOpenDay(d)}>
                  <div className="week-day-head">
                    <div className="week-day-name">
                      <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                      <span className="week-day-date">{fromKey(d).getDate()}</span>
                    </div>
                    <span className={'week-day-total' + (total ? '' : ' free')}>{total ? formatDuration(total) : 'свободно'}</span>
                  </div>
                  <div className="week-bar">
                    {segments.map((s, i) => (
                      <div key={i} className={`${catClass(s.category)}`} style={{ flexGrow: s.minutes, background: 'var(--c)' }} />
                    ))}
                    {(free > 0 || !segments.length) && <div style={{ flexGrow: free || 1 }} />}
                  </div>
                  {items.length > 0 && <div className="week-day-titles">{items.map((t) => t.title).join(' · ')}</div>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

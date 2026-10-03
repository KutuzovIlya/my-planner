import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { QuickAdd } from '../components/QuickAdd'
import { Swipe } from '../components/Swipe'
import { usePager } from '../components/usePager'
import { addDays, daysBetween, formatLong, formatTime, todayKey, WEEKDAYS, weekday } from '../dates'
import { ChevronLeft, ChevronRight, Search, Plus, Repeat } from '../icons'
import { categoryLabel, isDoneOn, isOverdue, occursOn, toggleDone, useTasks, type Task, type TaskDraft } from '../store'

const HOUR = 52
const DAY_START = 8
const DAY_END = 18

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function dayTitle(day: string, today: string): string {
  const diff = daysBetween(today, day)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  if (diff === -1) return 'Вчера'
  const w = WEEKDAYS[weekday(day)]
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/** Раскладка пересекающихся дел по колонкам */
function layout(tasks: Task[]) {
  const sorted = [...tasks].sort((a, b) => a.start! - b.start! || b.duration - a.duration)
  const out: { task: Task; lane: number; lanes: number }[] = []
  let cluster: typeof out = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    cluster.forEach((c) => (c.lanes = laneEnds.length))
    out.push(...cluster)
    cluster = []
    laneEnds = []
  }
  for (const task of sorted) {
    const s = task.start!
    const e = s + Math.max(task.duration, 15)
    if (s >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= s)
    if (lane === -1) lane = laneEnds.push(e) - 1
    else laneEnds[lane] = e
    cluster.push({ task, lane, lanes: 0 })
    clusterEnd = Math.max(clusterEnd, e)
  }
  flush()
  return out
}

export function Today({ day, onDayChange, onEdit, onNew, onSearch }: {
  onSearch: () => void
  day: string
  onDayChange: (day: string) => void
  onEdit: (t: Task, day: string) => void
  onNew: (initial: Partial<TaskDraft>) => void
}) {
  const tasks = useTasks()
  const now = useNow()
  const today = todayKey(now)
  const [slide, setSlide] = useState<'left' | 'right' | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const setDay = (next: string) => {
    if (next === day) return
    setSlide(next > day ? 'left' : 'right')
    onDayChange(next)
  }

  const { handlers, pageStyle } = usePager((dir) => setDay(addDays(day, dir)))

  const isToday = day === today
  const dayTasks = tasks.filter((t) => occursOn(t, day))
  const timed = dayTasks.filter((t) => t.start !== null)
  const untimed = [
    ...(isToday ? tasks.filter((t) => isOverdue(t, today)) : []),
    ...dayTasks.filter((t) => t.start === null),
  ].sort((a, b) => Number(isDoneOn(a, day)) - Number(isDoneOn(b, day)))

  const firstHour = Math.min(DAY_START, ...timed.map((t) => Math.floor(t.start! / 60)))
  const lastHour = Math.min(24, Math.max(DAY_END, ...timed.map((t) => Math.ceil((t.start! + t.duration) / 60))))
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)
  const y = (min: number) => ((min - firstHour * 60) / 60) * HOUR

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const showNow = isToday && nowMin >= firstHour * 60 && nowMin <= lastHour * 60

  // при открытии дня — прокрутить к текущему времени или к первому делу
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = isToday ? nowMin - 60 : Math.min(...timed.map((t) => t.start!), DAY_START * 60)
    el.scrollTop = Math.max(0, y(target))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  return (
    <div className="pager" {...handlers}>
      <header className="header">
        <div className="header-row">
          <div>
            <div className="title">{dayTitle(day, today)}</div>
            <div className="subtitle">
              <span>{formatLong(day)}</span>
              {!isToday && (
                <button className="today-pill" onClick={() => setDay(today)}>к сегодня</button>
              )}
            </div>
          </div>
          <div className="day-nav">
            <button className="icon-btn" onClick={onSearch} aria-label="Найти дело"><Search size={21} /></button>
            <button className="icon-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Предыдущий день"><ChevronLeft /></button>
            <button className="icon-btn" onClick={() => setDay(addDays(day, 1))} aria-label="Следующий день"><ChevronRight /></button>
            <button className="icon-btn" onClick={() => onNew({ date: day })} aria-label="Новое дело"><Plus /></button>
          </div>
        </div>
      </header>

      <div
        key={day}
        className={'pager-page' + (slide ? ' slide-' + slide : '')}
        style={pageStyle}
      >
      <div className="untimed">
        {untimed.length > 0 ? (
          <>
            <div className="untimed-label">Без времени · {untimed.length}</div>
            <div className="chips">
              {untimed.map((t) => {
                const overdue = isOverdue(t, today)
                const done = isDoneOn(t, day)
                return (
                  <Swipe key={t.id} onSwipe={() => toggleDone(t.id, day)} style={{ borderRadius: 16, maxWidth: '100%' }}>
                    <button
                      className={`chip cat-${t.category}` + (overdue ? ' overdue' : '') + (done ? ' done' : '')}
                      onClick={() => onEdit(t, day)}
                    >
                      <span className="dot" />
                      <span>{t.title}</span>
                    </button>
                  </Swipe>
                )
              })}
            </div>
          </>
        ) : dayTasks.length === 0 ? (
          <div className="untimed-label">Пусто. Нажми на час или напиши дело внизу — свайп вправо отмечает «сделано».</div>
        ) : null}
      </div>

      <div className="scroll" ref={scrollRef} style={{ background: 'var(--bg)' }}>
        <div className="timeline">
          {hours.map((h) => (
            <div key={h} className="hour">{h === 24 ? '0:00' : `${h}:00`}</div>
          ))}

          {hours.slice(0, -1).map((h) => (
            <button
              key={h}
              className="slot"
              style={{ top: y(h * 60) }}
              onClick={() => onNew({ date: day, start: h * 60, duration: 60 })}
              aria-label={`Добавить дело на ${h}:00`}
            />
          ))}

          <div style={{ position: 'absolute', left: 56, right: 16, top: 0 }}>
            {layout(timed).map(({ task: t, lane, lanes }) => {
              const h = Math.max(22, (t.duration / 60) * HOUR - 4)
              const short = h < 40
              const done = isDoneOn(t, day)
              const time = `${formatTime(t.start!)} – ${formatTime(t.start! + t.duration)}`
              return (
                <Swipe
                  key={t.id}
                  onSwipe={() => toggleDone(t.id, day)}
                  style={{
                    position: 'absolute',
                    top: y(t.start!) + 2,
                    height: h,
                    left: `calc(${(lane / lanes) * 100}% + ${lane ? 2 : 0}px)`,
                    width: `calc(${100 / lanes}% - ${lanes > 1 ? 2 : 0}px)`,
                    borderRadius: 8,
                    zIndex: 1,
                  }}
                >
                  <button
                    className={`event cat-${t.category}` + (short ? ' short' : '') + (done ? ' done' : '')}
                    style={{ inset: 0 }}
                    onClick={() => onEdit(t, day)}
                  >
                    {short ? (
                      <div className="event-title">{t.title} · {formatTime(t.start!)}</div>
                    ) : (
                      <div style={{ minWidth: 0 }}>
                        <div className="event-title">{t.title}</div>
                        <div className="event-meta">{time} · {categoryLabel(t.category)}</div>
                      </div>
                    )}
                    {t.repeat !== 'none' && !short && <Repeat />}
                  </button>
                </Swipe>
              )
            })}
          </div>

          {showNow && <div className="now-line" style={{ top: y(nowMin) }} />}
        </div>
      </div>

      </div>

      <QuickAdd defaultDate={day} />
    </div>
  )
}

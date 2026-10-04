import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { QuickAdd } from '../components/QuickAdd'
import { Swipe } from '../components/Swipe'
import { useLongPressDrag } from '../components/useLongPressDrag'
import { usePager } from '../components/usePager'
import { addDays, daysBetween, formatLong, formatTime, todayKey, WEEKDAYS, weekday } from '../dates'
import { ChevronLeft, ChevronRight, Search, Plus, Repeat } from '../icons'
import { categoryLabel, isDoneOn, isOverdue, occursOn, toggleDone, updateTask, useTasks, type Task, type TaskDraft } from '../store'

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

const SNAP = 15

/** Блок дела на сетке: тап — открыть, свайп вправо — сделано, зажать и тащить — перенести по времени */
function TimelineEvent({ task: t, day, lane, lanes, y, scrollRef, onEdit }: {
  task: Task
  day: string
  lane: number
  lanes: number
  y: (min: number) => number
  scrollRef: React.RefObject<HTMLDivElement | null>
  onEdit: (t: Task, day: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState<number | null>(null) // сдвиг в минутах, пока тащим
  const drag = useRef({ y0: 0, scroll0: 0, clientY: 0, raf: 0 })

  const minutesFor = (clientY: number) => {
    const el = scrollRef.current
    const dy = clientY - drag.current.y0 + (el ? el.scrollTop - drag.current.scroll0 : 0)
    const raw = Math.round((dy / HOUR) * 60 / SNAP) * SNAP
    return Math.max(-t.start!, Math.min(24 * 60 - t.duration - t.start!, raw))
  }

  // автопрокрутка, когда тащим дело к краю
  const autoScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cy = drag.current.clientY
    const edge = 48
    const v = cy < r.top + edge ? -(r.top + edge - cy) / 4 : cy > r.bottom - edge ? (cy - (r.bottom - edge)) / 4 : 0
    if (v) {
      el.scrollTop += Math.max(-14, Math.min(14, v))
      setShift(minutesFor(cy))
    }
    drag.current.raf = requestAnimationFrame(autoScroll)
  }

  useLongPressDrag(ref, {
    onStart: (clientY) => {
      drag.current = { y0: clientY, scroll0: scrollRef.current?.scrollTop ?? 0, clientY, raf: 0 }
      setShift(0)
      drag.current.raf = requestAnimationFrame(autoScroll)
    },
    onMove: (clientY) => {
      drag.current.clientY = clientY
      setShift(minutesFor(clientY))
    },
    onEnd: (clientY) => {
      cancelAnimationFrame(drag.current.raf)
      const delta = clientY === null ? 0 : minutesFor(clientY)
      if (delta) updateTask(t.id, { start: t.start! + delta })
      setShift(null)
    },
  })

  const start = t.start! + (shift ?? 0)
  const h = Math.max(22, (t.duration / 60) * HOUR - 4)
  const short = h < 40
  const done = isDoneOn(t, day)
  const time = `${formatTime(start)} – ${formatTime(start + t.duration)}`

  return (
    <div ref={ref}>
      <Swipe
        onSwipe={() => toggleDone(t.id, day)}
        className={shift !== null ? 'drag-lifted' : ''}
        style={{
          position: 'absolute',
          top: y(start) + 2,
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
            <div className="event-title">{t.title} · {formatTime(start)}</div>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div className="event-title">{t.title}</div>
              <div className="event-meta">{time} · {categoryLabel(t.category)}</div>
            </div>
          )}
          {t.repeat !== 'none' && !short && <Repeat />}
        </button>
      </Swipe>
    </div>
  )
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
            {layout(timed).map(({ task: t, lane, lanes }) => (
              <TimelineEvent
                key={t.id}
                task={t}
                day={day}
                lane={lane}
                lanes={lanes}
                y={y}
                scrollRef={scrollRef}
                onEdit={onEdit}
              />
            ))}
          </div>

          {showNow && <div className="now-line" style={{ top: y(nowMin) }} />}
        </div>
      </div>

      </div>

      <QuickAdd defaultDate={day} />
    </div>
  )
}

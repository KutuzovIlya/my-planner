import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { QuickAdd } from '../components/QuickAdd'
import { Swipe } from '../components/Swipe'
import { useLongPressDrag } from '../components/useLongPressDrag'
import { usePager } from '../components/usePager'
import { addDays, daysBetween, formatLong, formatTime, todayKey, WEEKDAYS, weekday } from '../dates'
import { Check, ChevronLeft, ChevronRight, Search, Plus, Repeat } from '../icons'
import { catClass, categoryLabel } from '../categories'
import { usePrefs } from '../prefs'
import { isDoneOn, isOverdue, occursOn, toggleDone, updateTask, useTasks, type Task, type TaskDraft } from '../store'

const HOUR = 52

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

/** Кружок «сделано» на блоке дела: тап отмечает, не открывая дело */
function DoneCheck({ done, small, onToggle }: { done: boolean; small?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={'done-check' + (done ? ' on' : '') + (small ? ' small' : '')}
      aria-label={done ? 'Снять отметку' : 'Отметить выполненным'}
      aria-pressed={done}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {done && <Check size={small ? 9 : 11} />}
    </button>
  )
}

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
        disabled={shift !== null}
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
        <div
          role="button"
          tabIndex={0}
          className={`event ${catClass(t.category)}` + (short ? ' short' : '') + (done ? ' done' : '')}
          style={{ inset: 0 }}
          onClick={() => onEdit(t, day)}
          onKeyDown={(e) => e.key === 'Enter' && onEdit(t, day)}
        >
          <DoneCheck done={done} small={short} onToggle={() => toggleDone(t.id, day)} />
          {short ? (
            <div className="event-title">{t.title} · {formatTime(start)}</div>
          ) : (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="event-title">{t.title}</div>
              <div className="event-meta">{time} · {categoryLabel(t.category)}</div>
            </div>
          )}
          {t.repeat !== 'none' && !short && <Repeat />}
        </div>
      </Swipe>
    </div>
  )
}

/** Чип дела без времени: тап — открыть, свайп — сделано, зажать — перетащить на сетку */
function UntimedChip({ task: t, day, overdue, dragging, onEdit, onDrag }: {
  task: Task
  day: string
  overdue: boolean
  dragging: boolean
  onEdit: (t: Task, day: string) => void
  onDrag: { onStart: (y: number, x: number) => void; onMove: (y: number, x: number) => void; onEnd: (y: number | null, x: number) => void }
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLongPressDrag(ref, onDrag)
  const done = isDoneOn(t, day)
  return (
    <div ref={ref} style={{ maxWidth: '100%', opacity: dragging ? 0.3 : 1 }}>
      <Swipe onSwipe={() => toggleDone(t.id, day)} disabled={dragging} style={{ borderRadius: 16, maxWidth: '100%' }}>
        <div
          role="button"
          tabIndex={0}
          className={`chip ${catClass(t.category)}` + (overdue ? ' overdue' : '') + (done ? ' done' : '')}
          onClick={() => onEdit(t, day)}
          onKeyDown={(e) => e.key === 'Enter' && onEdit(t, day)}
        >
          <DoneCheck done={done} small onToggle={() => toggleDone(t.id, day)} />
          <span>{t.title}</span>
        </div>
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
  const { dayStart: DAY_START, dayEnd: DAY_END } = usePrefs()
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

  // ——— перетаскивание дела «без времени» на сетку ———
  const timelineRef = useRef<HTMLDivElement>(null)
  const [chipDrag, setChipDrag] = useState<{ task: Task; x: number; y: number } | null>(null)
  const chipRaf = useRef(0)
  const chipPos = useRef({ x: 0, y: 0 })

  /** Время под пальцем (или null, если палец не над сеткой) */
  const dropMinutes = (clientY: number): number | null => {
    const sc = scrollRef.current?.getBoundingClientRect()
    const tl = timelineRef.current?.getBoundingClientRect()
    if (!sc || !tl || clientY < sc.top || clientY > sc.bottom) return null
    const raw = firstHour * 60 + ((clientY - tl.top) / HOUR) * 60
    return Math.max(0, Math.min(23 * 60, Math.round(raw / SNAP) * SNAP))
  }

  const chipDragHandlers = (t: Task) => ({
    onStart: (y: number, x: number) => {
      chipPos.current = { x, y }
      setChipDrag({ task: t, x, y })
      // автопрокрутка сетки у краёв
      const tick = () => {
        const el = scrollRef.current
        const cy = chipPos.current.y
        if (el) {
          const r = el.getBoundingClientRect()
          const edge = 48
          const v = cy > r.bottom - edge && cy < r.bottom + 60 ? (cy - (r.bottom - edge)) / 4 : cy < r.top + edge && cy > r.top ? -(r.top + edge - cy) / 4 : 0
          if (v) {
            el.scrollTop += Math.max(-14, Math.min(14, v))
            setChipDrag((d) => (d ? { ...d } : d))
          }
        }
        chipRaf.current = requestAnimationFrame(tick)
      }
      chipRaf.current = requestAnimationFrame(tick)
    },
    onMove: (y: number, x: number) => {
      chipPos.current = { x, y }
      setChipDrag({ task: t, x, y })
    },
    onEnd: (y: number | null) => {
      cancelAnimationFrame(chipRaf.current)
      const min = y === null ? null : dropMinutes(y)
      if (min !== null) {
        // по умолчанию — час; просроченное дело переезжает на этот день
        updateTask(t.id, { start: min, duration: 60, ...(t.repeat === 'none' ? { date: day } : {}) })
      }
      setChipDrag(null)
    },
  })
  const chipDrop = chipDrag ? dropMinutes(chipDrag.y) : null

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
              {untimed.map((t) => (
                <UntimedChip
                  key={t.id}
                  task={t}
                  day={day}
                  overdue={isOverdue(t, today)}
                  dragging={chipDrag?.task.id === t.id}
                  onEdit={onEdit}
                  onDrag={chipDragHandlers(t)}
                />
              ))}
            </div>
          </>
        ) : dayTasks.length === 0 ? (
          <div className="untimed-label">Пусто. Нажми на час или напиши дело внизу — свайп вправо отмечает «сделано».</div>
        ) : null}
      </div>

      <div className="scroll" ref={scrollRef} style={{ background: 'var(--bg)' }}>
        <div className="timeline" ref={timelineRef}>
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

          {chipDrag && chipDrop !== null && (
            <div className={`event-ghost ${catClass(chipDrag.task.category)}`} style={{ top: y(chipDrop) + 2, height: HOUR - 4 }}>
              {formatTime(chipDrop)} – {formatTime(chipDrop + 60)}
            </div>
          )}

          {showNow && <div className="now-line" style={{ top: y(nowMin) }} />}
        </div>
      </div>

      </div>

      <QuickAdd defaultDate={day} />

      {chipDrag && (
        <div className={`chip chip-floating ${catClass(chipDrag.task.category)}`} style={{ left: chipDrag.x, top: chipDrag.y }}>
          <span className="dot" />
          <span>{chipDrag.task.title}</span>
        </div>
      )}
    </div>
  )
}

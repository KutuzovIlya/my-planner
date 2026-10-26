import { useState } from 'react'
import { addDays, daysBetween, formatDay, formatRange, formatRelative, todayKey } from '../dates'
import { ChevronLeft, ChevronRight, Plus } from '../icons'
import { formatMoney, sourceColor, sourcesByTotal, sum, useIncome, type Income } from '../money'

type Mode = 'month' | 'year' | 'range' | 'all'

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю']

const yearOf = (date: string) => Number(date.slice(0, 4))
const monthOf = (date: string) => Number(date.slice(5, 7)) - 1

/** Период: месяц, год или свои даты «с … по …», к которым привязан экран */
interface Period {
  mode: Mode
  year: number
  /** 0–11, для режима «месяц» */
  month: number
  /** 'YYYY-MM-DD', для режима «период» (включительно) */
  from: string
  to: string
}

function inPeriod(i: Income, p: Period): boolean {
  if (p.mode === 'all') return true
  if (p.mode === 'range') return i.date >= p.from && i.date <= p.to
  if (yearOf(i.date) !== p.year) return false
  return p.mode === 'year' || monthOf(i.date) === p.month
}

function shift(p: Period, by: number): Period {
  if (p.mode === 'year') return { ...p, year: p.year + by }
  const m = p.year * 12 + p.month + by
  return { ...p, year: Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
}

function periodTitle(p: Period): string {
  if (p.mode === 'all') return 'За всё время'
  if (p.mode === 'range') {
    if (p.from === p.to) return formatDay(p.from)
    const y = new Date().getFullYear()
    const sameYear = yearOf(p.from) === yearOf(p.to)
    if (sameYear && yearOf(p.from) === y) return formatRange(p.from, p.to)
    return `${formatDay(p.from)} ${yearOf(p.from)} – ${formatDay(p.to)} ${yearOf(p.to)}`
  }
  if (p.mode === 'year') return `${p.year} год`
  const name = MONTHS[p.month][0].toUpperCase() + MONTHS[p.month].slice(1)
  return p.year === new Date().getFullYear() ? name : `${name} ${p.year}`
}

/** «+12% к сентябрю» */
function compare(cur: number, prev: number, p: Period): { text: string; up: boolean } | null {
  if (p.mode === 'all' || p.mode === 'range' || prev <= 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  const to = p.mode === 'year' ? `к ${p.year - 1}` : `к ${MONTHS_DAT[shift(p, -1).month]}`
  return { text: `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct)}% ${to}`, up: pct >= 0 }
}

interface Bar {
  key: string
  label: string
  /** подпись над графиком, если отличается от подписи столбика */
  title?: string
  value: number
  current: boolean
  /** куда перейти по второму нажатию; нет — столбик только показывает сумму */
  go?: Period
}

type Unit = 'day' | 'month' | 'year'

/** Чем делить период «с … по …» на столбики, чтобы их было не слишком много */
function rangeUnit(p: Period): Unit {
  const months = (yearOf(p.to) - yearOf(p.from)) * 12 + monthOf(p.to) - monthOf(p.from) + 1
  if (daysBetween(p.from, p.to) < 31) return 'day'
  return months <= 24 ? 'month' : 'year'
}

function chartUnit(p: Period): Unit {
  if (p.mode === 'all') return 'year'
  if (p.mode === 'range') return rangeUnit(p)
  return 'month'
}

function yearBars(list: Income[], from: number, to: number, p: Period): Bar[] {
  return Array.from({ length: to - from + 1 }, (_, k) => {
    const y = from + k
    return { key: String(y), label: String(y), value: sum(list.filter((i) => yearOf(i.date) === y)), current: false, go: { ...p, mode: 'year', year: y } }
  })
}

function bars(list: Income[], p: Period): Bar[] {
  if (p.mode === 'all') {
    const years = list.map((i) => yearOf(i.date))
    const now = new Date().getFullYear()
    return yearBars(list, Math.min(now, ...years), Math.max(now, ...years), p)
  }
  if (p.mode === 'range') {
    const unit = rangeUnit(p)
    if (unit === 'year') return yearBars(list, yearOf(p.from), yearOf(p.to), p)
    if (unit === 'day') {
      return Array.from({ length: daysBetween(p.from, p.to) + 1 }, (_, k) => {
        const d = addDays(p.from, k)
        const n = Number(d.slice(8))
        // при длинном периоде подписываем не каждый день, иначе подписи слипаются
        const label = n === 1 || k === 0 || daysBetween(p.from, p.to) < 14 || n % 5 === 0 ? String(n) : ''
        return { key: d, label, title: formatDay(d), value: sum(list.filter((i) => i.date === d)), current: false }
      })
    }
    const start = yearOf(p.from) * 12 + monthOf(p.from)
    const end = yearOf(p.to) * 12 + monthOf(p.to)
    return Array.from({ length: end - start + 1 }, (_, k) => {
      const y = Math.floor((start + k) / 12)
      const m = (start + k) % 12
      return {
        key: `${y}-${m}`,
        label: MONTHS_SHORT[m],
        value: sum(list.filter((i) => inPeriod(i, p) && yearOf(i.date) === y && monthOf(i.date) === m)),
        current: false,
        go: { ...p, mode: 'month', year: y, month: m },
      }
    })
  }
  return MONTHS_SHORT.map((label, m) => ({
    key: String(m),
    label,
    value: sum(list.filter((i) => yearOf(i.date) === p.year && monthOf(i.date) === m)),
    current: p.mode === 'month' && m === p.month,
    go: { ...p, mode: 'month', year: p.year, month: m },
  }))
}

function Chart({ data, onPick }: { data: Bar[]; onPick: (p: Period) => void }) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(...data.map((b) => b.value), 1)
  const shown = data.find((b) => b.key === active) ?? data.find((b) => b.current)
  return (
    <div className="money-chart">
      <div className="money-chart-head">
        {shown ? (
          <>
            <span>{shown.title ?? shown.label}</span> <b>{formatMoney(shown.value)}</b>
          </>
        ) : (
          <span>Нажми на столбик — покажу сумму</span>
        )}
      </div>
      <div className="money-bars" onPointerLeave={() => setActive(null)}>
        {data.map((b) => (
          <button
            key={b.key}
            className={'money-bar' + (b.current ? ' current' : '') + (b.key === active ? ' active' : '')}
            onPointerEnter={() => setActive(b.key)}
            onClick={() => (b.go && (active === b.key || b.current) ? onPick(b.go) : setActive(b.key))}
            aria-label={`${b.label}: ${formatMoney(b.value)}`}
          >
            <span className="money-bar-track">
              <span className="money-bar-fill" style={{ height: b.value ? `max(4px, ${(b.value / max) * 100}%)` : 0 }} />
            </span>
            <span className="money-bar-label">{b.label}</span>
          </button>
        ))}
      </div>
      {data[0]?.go && <div className="hint">Нажми ещё раз, чтобы открыть {data[0].go.mode === 'year' ? 'год' : 'месяц'}</div>}
    </div>
  )
}

export function Money({ onNew, onEdit }: { onNew: (source?: string) => void; onEdit: (i: Income) => void }) {
  const all = useIncome()
  const now = new Date()
  const today = todayKey()
  const [period, setPeriod] = useState<Period>({ mode: 'month', year: now.getFullYear(), month: now.getMonth(), from: today.slice(0, 8) + '01', to: today })
  const [source, setSource] = useState<string | null>(null)

  const sources = sourcesByTotal(all)
  const scoped = source ? all.filter((i) => i.source === source) : all
  const items = scoped.filter((i) => inPeriod(i, period))
  const total = sum(items)
  const prev = period.mode === 'all' || period.mode === 'range' ? 0 : sum(scoped.filter((i) => inPeriod(i, shift(period, -1))))
  const cmp = compare(total, prev, period)

  // среднее в месяц: за год — по прошедшим месяцам, за всё время — с первого заработка,
  // за свои даты — по месяцам периода (если он длиннее месяца)
  let perMonth: number | null = null
  if (period.mode === 'range' && items.length) {
    const months = (yearOf(period.to) - yearOf(period.from)) * 12 + monthOf(period.to) - monthOf(period.from) + 1
    if (months > 1) perMonth = total / months
  } else if (period.mode !== 'month' && items.length) {
    const first = items.reduce((a, i) => (i.date < a ? i.date : a), items[0].date)
    const start = period.mode === 'year' ? period.year * 12 : yearOf(first) * 12 + monthOf(first)
    const end = period.mode === 'year' && period.year < now.getFullYear() ? period.year * 12 + 11 : now.getFullYear() * 12 + now.getMonth()
    perMonth = total / Math.max(1, end - start + 1)
  }

  // даты «с … по …»: если «с» позже «по», второе подтягиваем следом
  const setFrom = (from: string) => from && setPeriod({ ...period, from, to: from > period.to ? from : period.to })
  const setTo = (to: string) => to && setPeriod({ ...period, to, from: to < period.from ? to : period.from })
  const unit = chartUnit(period)

  const bySource = sources
    .map((s) => ({ s, value: sum(items.filter((i) => i.source === s)) }))
    .filter((x) => x.value > 0)
  const topSource = Math.max(...bySource.map((x) => x.value), 1)

  const list = [...items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)

  const dayLabel = (d: string) => (yearOf(d) === now.getFullYear() ? formatRelative(d, today) : `${formatRelative(d, today)} ${yearOf(d)}`)

  return (
    <>
      <header className="header">
        <div className="header-row">
          <div className="title">Деньги</div>
          <button className="icon-btn" onClick={() => onNew(source ?? undefined)} aria-label="Добавить заработок"><Plus /></button>
        </div>
        <div className="segmented">
          {(['month', 'year', 'range', 'all'] as Mode[]).map((m) => (
            <button key={m} className={period.mode === m ? 'on' : ''} onClick={() => setPeriod({ ...period, mode: m })}>
              {m === 'month' ? 'Месяц' : m === 'year' ? 'Год' : m === 'range' ? 'Период' : 'Всё время'}
            </button>
          ))}
        </div>
        {period.mode === 'range' && (
          <div className="money-range">
            <label>
              <span>с</span>
              <input type="date" className="pill-input" value={period.from} onChange={(e) => setFrom(e.target.value)} aria-label="С какого дня" />
            </label>
            <label>
              <span>по</span>
              <input type="date" className="pill-input" value={period.to} onChange={(e) => setTo(e.target.value)} aria-label="По какой день" />
            </label>
          </div>
        )}
      </header>

      <div className="scroll">
        {all.length === 0 ? (
          <div className="empty">
            <b>Здесь будет твой заработок</b>
            Нажми «+» и запиши, сколько пришло и откуда — здесь появятся итоги за месяц, год и всё время.
          </div>
        ) : (
          <div className="task-list">
            {sources.length > 1 && (
              <div className="money-filter" role="group" aria-label="Источник">
                <button className={'pill' + (source === null ? ' on' : '')} onClick={() => setSource(null)}>Все источники</button>
                {sources.map((s) => (
                  <button key={s} className={`pill cc-${sourceColor(s, sources)}` + (source === s ? ' on' : '')} onClick={() => setSource(source === s ? null : s)}>
                    <span className="dot" /> {s}
                  </button>
                ))}
              </div>
            )}

            <section className="money-total">
              <div className="money-period">
                {(period.mode === 'month' || period.mode === 'year') && (
                  <button className="icon-btn" onClick={() => setPeriod(shift(period, -1))} aria-label="Назад"><ChevronLeft /></button>
                )}
                <span>{periodTitle(period)}{source ? ` · ${source}` : ''}</span>
                {(period.mode === 'month' || period.mode === 'year') && (
                  <button className="icon-btn" onClick={() => setPeriod(shift(period, 1))} aria-label="Вперёд"><ChevronRight /></button>
                )}
              </div>
              <div className="money-sum">{formatMoney(total)}</div>
              <div className="money-sub">
                {items.length ? `${items.length} ${plural(items.length, 'поступление', 'поступления', 'поступлений')}` : 'Пока ничего'}
                {perMonth !== null && ` · в среднем ${formatMoney(Math.round(perMonth))} в месяц`}
              </div>
              {cmp && <div className={'money-cmp' + (cmp.up ? ' up' : ' down')}>{cmp.text}</div>}
            </section>

            <section className="section">
              <div className="section-title">
                {unit === 'year' ? 'По годам' : unit === 'day' ? 'По дням' : period.mode === 'range' ? 'По месяцам' : `По месяцам · ${period.year}`}
              </div>
              <div className="group">
                <Chart data={bars(scoped, period)} onPick={setPeriod} />
              </div>
            </section>

            {!source && bySource.length > 0 && (
              <section className="section">
                <div className="section-title">По источникам</div>
                <div className="group">
                  {bySource.map(({ s, value }) => (
                    <button key={s} className={`row money-source cc-${sourceColor(s, sources)}`} onClick={() => setSource(s)}>
                      <span className="row-body">
                        <span className="money-source-head">
                          <span className="row-title">{s}</span>
                          <span className="money-source-sum">{formatMoney(value)}</span>
                        </span>
                        <span className="money-source-bar">
                          <span style={{ width: `${(value / topSource) * 100}%` }} />
                        </span>
                        <span className="row-meta">{Math.round((value / total) * 100)}% от суммы</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {list.length > 0 && (
              <section className="section">
                <div className="section-title">Поступления</div>
                <div className="group">
                  {list.map((i) => (
                    <button key={i.id} className={`row cc-${sourceColor(i.source, sources)}`} onClick={() => onEdit(i)}>
                      <span className="dot" style={{ width: 8, height: 8 }} />
                      <span className="row-body">
                        <span className="row-title">{i.source}</span>
                        <span className="row-meta">{dayLabel(i.date)}{i.note ? ` · ${i.note}` : ''}</span>
                      </span>
                      <span className="money-amount">{formatMoney(i.amount)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

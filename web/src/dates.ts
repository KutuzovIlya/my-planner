// Даты храним строками 'YYYY-MM-DD' в локальном времени, время — минутами от полуночи.

export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(now = new Date()): string {
  return toKey(now)
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000)
}

/** 0 = воскресенье … 6 = суббота */
export function weekday(key: string): number {
  return fromKey(key).getDay()
}

export function formatDay(key: string): string {
  const d = fromKey(key)
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}

export function formatLong(key: string): string {
  return `${WEEKDAYS[weekday(key)]}, ${formatDay(key)}`
}

/** «сегодня», «завтра», «вчера» или «3 сентября» */
export function formatRelative(key: string, today: string): string {
  const diff = daysBetween(today, key)
  if (diff === 0) return 'сегодня'
  if (diff === 1) return 'завтра'
  if (diff === -1) return 'вчера'
  return formatDay(key)
}

export function formatTime(min: number): string {
  return `${Math.floor(min / 60)}:${pad(min % 60)}`
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} ч ${m} м`
  if (h) return `${h} ч`
  return `${m} м`
}

export function timeToInput(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

export function inputToTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Понедельник недели, в которую входит день */
export function weekStart(key: string): string {
  return addDays(key, -((weekday(key) + 6) % 7))
}

/** «5 – 11 октября» или «28 сентября – 4 октября» */
export function formatRange(from: string, to: string): string {
  const a = fromKey(from)
  const b = fromKey(to)
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${formatDay(to)}`
  return `${formatDay(from)} – ${formatDay(to)}`
}

import { addDays, daysBetween, toKey, weekday } from './dates'
import type { Category, Repeat } from './store'

// Разбор строки быстрого ввода:
// «Спортзал завтра в 18 1ч #здоровье» → название, дата, время, длительность, категория.

export interface Parsed {
  title: string
  date: string | null
  start: number | null
  duration: number | null
  category: Category | null
  repeat: Repeat
}

// \b не работает с кириллицей — границы слов задаём сами
const B = '(?<![\\p{L}\\d])'
const E = '(?![\\p{L}\\d])'
const rx = (body: string) => new RegExp(B + body + E, 'iu')

const CATEGORY_TAGS: Record<string, Category> = {
  работа: 'work', работы: 'work', р: 'work',
  личное: 'personal', л: 'personal',
  здоровье: 'health', з: 'health',
  дом: 'home', д: 'home',
}

const MONTHS: [string, number][] = [
  ['янв', 0], ['фев', 1], ['мар', 2], ['апр', 3], ['ма[йя]', 4], ['июн', 5],
  ['июл', 6], ['авг', 7], ['сен', 8], ['окт', 9], ['ноя', 10], ['дек', 11],
]

// 1 = понедельник … 0 = воскресенье
const WEEKDAY_WORDS: [string, number][] = [
  ['понедельник|пн', 1], ['вторник|вт', 2], ['среду|среда|ср', 3], ['четверг|чт', 4],
  ['пятницу|пятница|пт', 5], ['субботу|суббота|сб', 6], ['воскресенье|вс', 0],
]

// «каждый вторник» / «по вторникам»
const WEEKLY_WORDS: [string, string, number][] = [
  ['понедельник', 'понедельникам', 1], ['вторник', 'вторникам', 2], ['среду', 'средам', 3],
  ['четверг', 'четвергам', 4], ['пятницу', 'пятницам', 5], ['субботу', 'субботам', 6],
  ['воскресенье', 'воскресеньям', 0],
]

function nextWeekday(today: string, wd: number): string {
  const diff = (wd - weekday(today) + 7) % 7
  return addDays(today, diff)
}

function hm(h: string, m?: string): number | null {
  const hh = Number(h)
  const mm = m ? Number(m) : 0
  if (hh > 23 || mm > 59) return null
  return hh * 60 + mm
}

export function parseQuick(input: string, today: string): Parsed {
  let s = ' ' + input + ' '
  const out: Parsed = { title: '', date: null, start: null, duration: null, category: null, repeat: 'none' }

  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean | void) => {
    const m = re.exec(s)
    if (m && fn(m) !== false) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)
  }

  // категория
  take(/#([\p{L}]+)/u, (m) => {
    const c = CATEGORY_TAGS[m[1].toLowerCase()]
    if (!c) return false
    out.category = c
  })

  // повтор
  take(rx('(?:каждый день|ежедневно)'), () => { out.repeat = 'daily' })
  take(rx('(?:по будням|в будни)'), () => { out.repeat = 'weekdays' })
  take(rx('(?:каждую неделю|еженедельно)'), () => { out.repeat = 'weekly' })
  for (const [each, plural, wd] of WEEKLY_WORDS) {
    take(rx(`(?:кажд(?:ый|ую|ое)\\s+${each}|по\\s+${plural})`), () => {
      out.repeat = 'weekly'
      out.date = nextWeekday(today, wd)
    })
  }

  // относительные даты
  take(rx('послезавтра'), () => { out.date = addDays(today, 2) })
  take(rx('завтра'), () => { out.date = addDays(today, 1) })
  take(rx('сегодня'), () => { out.date = today })
  for (const [words, wd] of WEEKDAY_WORDS) {
    take(rx(`(?:во?\\s+)?(?:${words})`), () => { out.date = nextWeekday(today, wd) })
  }

  // «31 августа», «5 сен»
  for (const [stem, month] of MONTHS) {
    take(rx(`(\\d{1,2})\\s+${stem}[\\p{L}]*\\.?`), (m) => {
      out.date = absoluteDate(Number(m[1]), month, null, today)
      if (!out.date) return false
    })
  }
  // «31.08», «31.08.2026»
  take(rx('(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?'), (m) => {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null
    out.date = absoluteDate(Number(m[1]), Number(m[2]) - 1, y, today)
    if (!out.date) return false
  })

  // интервал «с 10 до 12», «10:00–11:30»
  take(rx('(?:с\\s+(\\d{1,2})(?::(\\d{2}))?|(\\d{1,2}):(\\d{2}))\\s*(?:до|-|–|—)\\s*(\\d{1,2})(?::(\\d{2}))?'), (m) => {
    const a = m[1] !== undefined ? hm(m[1], m[2]) : hm(m[3], m[4])
    const b = hm(m[5], m[6])
    if (a === null || b === null || b <= a) return false
    out.start = a
    out.duration = b - a
  })

  // длительность «1ч», «1ч30м», «на 2 часа», «45 мин», «полчаса»
  take(rx('(?:на\\s+)?полчаса'), () => { out.duration = 30 })
  take(rx('(?:на\\s+)?(\\d+(?:[.,]5)?)\\s*(?:ч|час|часа|часов)(?:\\s*(\\d+)\\s*(?:м|мин|минут|минуты))?'), (m) => {
    out.duration = Math.round(parseFloat(m[1].replace(',', '.')) * 60) + (m[2] ? Number(m[2]) : 0)
  })
  take(rx('(?:на\\s+)?(\\d+)\\s*(?:м|мин|минут|минуты|минуту)'), (m) => {
    out.duration = Number(m[1])
  })

  // время «в 10», «в 10:30», «10:30»
  if (out.start === null) {
    take(rx('(?:в\\s+(\\d{1,2})(?::(\\d{2}))?|(\\d{1,2}):(\\d{2}))'), (m) => {
      const t = m[1] !== undefined ? hm(m[1], m[2]) : hm(m[3], m[4])
      if (t === null) return false
      out.start = t
    })
  }

  const title = s.replace(/\s+/g, ' ').trim().replace(/^[,.;:–—-]+|[,.;:–—-]+$/g, '').trim()
  out.title = title.charAt(0).toUpperCase() + title.slice(1)
  return out
}

function absoluteDate(day: number, month: number, year: number | null, today: string): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  const ty = Number(today.slice(0, 4))
  let d = new Date(year ?? ty, month, day)
  if (d.getMonth() !== month) return null
  // без года и уже прошло — значит, в следующем году
  if (year === null && daysBetween(today, toKey(d)) < 0) d = new Date(ty + 1, month, day)
  return toKey(d)
}

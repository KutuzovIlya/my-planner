import { addDays, daysBetween, toKey, weekday } from './dates'
import { DEFAULT_CATEGORIES } from './categories'
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

/** #тег → категория: точное совпадение названия (без пробелов) или начало, например «#р» → «работа» */
function matchCategory(tag: string, categories: { id: string; label: string }[]): string | null {
  const t = tag.toLowerCase()
  const norm = (l: string) => l.toLowerCase().replace(/\s+/g, '')
  return (categories.find((c) => norm(c.label) === t) ?? categories.find((c) => norm(c.label).startsWith(t)))?.id ?? null
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

export function parseQuick(input: string, today: string, categories: { id: string; label: string }[] = DEFAULT_CATEGORIES): Parsed {
  let s = normalizeSpoken(' ' + input + ' ')
  const out: Parsed = { title: '', date: null, start: null, duration: null, category: null, repeat: 'none' }

  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean | void) => {
    const m = re.exec(s)
    if (m && fn(m) !== false) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)
  }

  // категория
  take(/#([\p{L}\d_-]+)/u, (m) => {
    const c = matchCategory(m[1], categories)
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
  take(rx('(?:с\\s+(\\d{1,2})(?::(\\d{2}))?|(\\d{1,2}):(\\d{2}))\\s*(?:до|-|–|—)\\s*(\\d{1,2})(?::(\\d{2}))?' + DAYPART), (m) => {
    const a = daypart(m[1] !== undefined ? hm(m[1], m[2]) : hm(m[3], m[4]), m[7])
    const b = daypart(hm(m[5], m[6]), m[7])
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
    take(rx('(?:в\\s+(\\d{1,2})(?::(\\d{2}))?|(\\d{1,2}):(\\d{2}))' + DAYPART), (m) => {
      const t = daypart(m[1] !== undefined ? hm(m[1], m[2]) : hm(m[3], m[4]), m[5])
      if (t === null) return false
      out.start = t
    })
  }

  const title = s.replace(/\s+/g, ' ').trim().replace(/^[,.;:–—-]+|[,.;:–—-]+$/g, '').trim()
  out.title = title.charAt(0).toUpperCase() + title.slice(1)
  return out
}

// «вечера», «дня», «утра», «ночи» после времени
const DAYPART = '(?:\\s+(утра|дня|вечера|ночи))?'

function daypart(t: number | null, part: string | undefined): number | null {
  if (t === null || !part) return t
  const h = Math.floor(t / 60)
  const p = part.toLowerCase()
  if (p === 'вечера' && h < 12) return t + 720
  if (p === 'дня' && h >= 1 && h <= 7) return t + 720
  if (p === 'ночи' && h === 12) return t - 720
  return t
}

const NUMBER_WORDS: Record<string, number> = {
  один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6,
  семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12,
  пятнадцать: 15, двадцать: 20, тридцать: 30, сорок: 40, 'сорок пять': 45,
}

/** Разговорные формы из голосового ввода → цифры: «в шесть вечера» → «в 6 вечера» */
function normalizeSpoken(s: string): string {
  const words = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')
  return s
    .replace(new RegExp(B + '(?:в\\s+)?полдень' + E, 'giu'), ' в 12:00 ')
    .replace(new RegExp(B + '(?:в\\s+)?полночь' + E, 'giu'), ' в 0:00 ')
    .replace(new RegExp(B + '(?:на\\s+)?полтора\\s+часа' + E, 'giu'), ' 90 мин ')
    .replace(new RegExp(B + 'на\\s+час' + E, 'giu'), ' на 1 ч ')
    .replace(new RegExp(B + '(в|с|до)\\s+час' + E, 'giu'), ' $1 1 ')
    .replace(new RegExp(B + '(в|с|до|на)\\s+(' + words + ')' + E, 'giu'), (_, pre: string, w: string) => ` ${pre} ${NUMBER_WORDS[w.toLowerCase()]} `)
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

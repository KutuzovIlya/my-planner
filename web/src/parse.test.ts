import { describe, expect, it } from 'vitest'
import { parseQuick } from './parse'

const today = '2026-10-04' // воскресенье
const p = (s: string) => parseQuick(s, today)

describe('parseQuick', () => {
  it('просто название', () => {
    expect(p('позвонить в банк')).toMatchObject({ title: 'Позвонить в банк', date: null, start: null })
  })
  it('завтра, время, длительность, категория', () => {
    expect(p('Спортзал завтра в 18 1ч #здоровье')).toEqual({
      title: 'Спортзал', date: '2026-10-05', start: 18 * 60, duration: 60, category: 'health', repeat: 'none', until: null,
    })
  })
  it('интервал времени', () => {
    expect(p('Созвон с командой с 9 до 10:30')).toMatchObject({ title: 'Созвон с командой', start: 540, duration: 90 })
    expect(p('Планёрка 10:00-11:00')).toMatchObject({ title: 'Планёрка', start: 600, duration: 60 })
  })
  it('день недели', () => {
    expect(p('Врач в пятницу 14:30')).toMatchObject({ title: 'Врач', date: '2026-10-09', start: 870 })
    expect(p('Уборка вс')).toMatchObject({ title: 'Уборка', date: '2026-10-04' })
  })
  it('абсолютные даты', () => {
    expect(p('Отчёт 3 ноября')).toMatchObject({ title: 'Отчёт', date: '2026-11-03' })
    expect(p('Оплатить 15.10')).toMatchObject({ title: 'Оплатить', date: '2026-10-15' })
    expect(p('Отпуск 1 сентября')).toMatchObject({ date: '2027-09-01' })
  })
  it('повторы', () => {
    expect(p('Разбор почты по будням в 9')).toMatchObject({ title: 'Разбор почты', repeat: 'weekdays', start: 540 })
    expect(p('Зарядка каждый день')).toMatchObject({ title: 'Зарядка', repeat: 'daily' })
    expect(p('Бассейн каждый вторник в 8')).toMatchObject({ title: 'Бассейн', repeat: 'weekly', date: '2026-10-06' })
  })
  it('не путает слова с днями недели', () => {
    expect(p('Купить вторсырьё')).toMatchObject({ title: 'Купить вторсырьё', date: null })
    expect(p('#неизвестно текст').category).toBeNull()
  })
})

describe('parseQuick: еженедельно', () => {
  it('по пятницам', () => {
    expect(parseQuick('Отчёт по пятницам в 17', '2026-10-04')).toMatchObject({ title: 'Отчёт', repeat: 'weekly', date: '2026-10-09', start: 1020 })
  })
})

describe('parseQuick: голосовой ввод', () => {
  const p = (s: string) => parseQuick(s, '2026-10-04')
  it('время словами и части дня', () => {
    expect(p('Спортзал завтра в шесть вечера')).toMatchObject({ title: 'Спортзал', date: '2026-10-05', start: 18 * 60 })
    expect(p('Врач в 3 дня')).toMatchObject({ title: 'Врач', start: 15 * 60 })
    expect(p('Пробежка в 7 утра')).toMatchObject({ title: 'Пробежка', start: 7 * 60 })
    expect(p('Обед в полдень')).toMatchObject({ title: 'Обед', start: 12 * 60 })
    expect(p('Обед в час дня')).toMatchObject({ title: 'Обед', start: 13 * 60 })
    expect(p('Кино с 7 до 9 вечера')).toMatchObject({ title: 'Кино', start: 19 * 60, duration: 120 })
    expect(p('Встреча в 18:00')).toMatchObject({ title: 'Встреча', start: 18 * 60 })
  })
  it('длительность словами', () => {
    expect(p('Уборка на полтора часа')).toMatchObject({ title: 'Уборка', duration: 90 })
    expect(p('Созвон в 10 на час')).toMatchObject({ title: 'Созвон', start: 600, duration: 60 })
    expect(p('Медитация на двадцать минут')).toMatchObject({ title: 'Медитация', duration: 20 })
  })
  it('не ломает обычные слова', () => {
    expect(p('Купить два батона')).toMatchObject({ title: 'Купить два батона' })
  })
})

describe('parseQuick: свои категории', () => {
  const cats = [{ id: 'work', label: 'работа' }, { id: 'c1', label: 'учёба' }, { id: 'c2', label: 'дача и сад' }]
  it('тег по названию, началу и без пробелов', () => {
    expect(parseQuick('Лекция в 10 #учёба', '2026-10-04', cats)).toMatchObject({ title: 'Лекция', category: 'c1' })
    expect(parseQuick('Отчёт #р', '2026-10-04', cats)).toMatchObject({ category: 'work' })
    expect(parseQuick('Полив #дачаисад', '2026-10-04', cats)).toMatchObject({ title: 'Полив', category: 'c2' })
  })
})

describe('parseQuick: периоды', () => {
  const p = (s: string) => parseQuick(s, '2026-10-07') // среда
  it('с … по … — каждый день в эти даты', () => {
    expect(p('Витамины с 7 по 15 октября')).toMatchObject({ title: 'Витамины', date: '2026-10-07', until: '2026-10-15', repeat: 'daily' })
    expect(p('Пробежка с сегодня по 15 в 7 утра')).toMatchObject({ title: 'Пробежка', date: '2026-10-07', until: '2026-10-15', repeat: 'daily', start: 420 })
    expect(p('Отпуск с 28 октября по 5 ноября')).toMatchObject({ date: '2026-10-28', until: '2026-11-05' })
    expect(p('Сборы с 28 по 5 ноября')).toMatchObject({ date: '2026-10-28', until: '2026-11-05' })
    expect(p('Курс с 1.10 до 20.10')).toMatchObject({ title: 'Курс', date: '2026-10-01', until: '2026-10-20' })
  })
  it('повтор с концом', () => {
    expect(p('Зарядка каждый день по 15 октября в 7')).toMatchObject({ title: 'Зарядка', repeat: 'daily', until: '2026-10-15', start: 420 })
    expect(p('Отчёт по будням до 20.10')).toMatchObject({ title: 'Отчёт', repeat: 'weekdays', until: '2026-10-20' })
    expect(p('Полив каждый день по 3')).toMatchObject({ until: '2026-11-03' })
  })
  it('время «с 10 до 12» не путается с датами', () => {
    expect(p('Созвон с 10 до 12')).toMatchObject({ title: 'Созвон', start: 600, duration: 120, until: null, repeat: 'none' })
  })
  it('срок «до 3 ноября»', () => {
    expect(p('Отчёт до 3 ноября')).toMatchObject({ title: 'Отчёт', date: '2026-11-03', repeat: 'none' })
  })
})

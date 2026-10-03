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
      title: 'Спортзал', date: '2026-10-05', start: 18 * 60, duration: 60, category: 'health', repeat: 'none',
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

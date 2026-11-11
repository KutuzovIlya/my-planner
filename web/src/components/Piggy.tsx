import { useEffect, useState } from 'react'
import { addDays, formatRelative, todayKey } from '../dates'
import { Calendar, Plus } from '../icons'
import { formatMoney, parseAmount } from '../money'
import { addSaving, deleteSaving, savedTotal, updateSaving, useSavings, type Saving } from '../savings'

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

const dayLabel = (d: string, today: string) =>
  d.slice(0, 4) === today.slice(0, 4) ? formatRelative(d, today) : `${formatRelative(d, today)} ${d.slice(0, 4)}`

/** Шторка «Копилка»: сколько накопил и все взносы */
export function PiggySheet({ onClose, onNew, onEdit }: { onClose: () => void; onNew: () => void; onEdit: (s: Saving) => void }) {
  useEscape(onClose)
  const today = todayKey()
  const all = useSavings()
  const list = [...all].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const total = savedTotal(all)
  const thisMonth = savedTotal(all.filter((s) => s.date.slice(0, 7) === today.slice(0, 7)))

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Копилка" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button onClick={onClose}>Закрыть</button>
          <h2>Копилка</h2>
          <button onClick={onNew} aria-label="Внести в копилку"><Plus size={22} /></button>
        </div>
        <div className="sheet-body">
          <section className="money-total">
            <div className="money-period"><span>Накоплено</span></div>
            <div className="money-sum">{formatMoney(total)}</div>
            <div className="money-sub">
              {all.length ? `${all.length} ${plural(all.length, 'взнос', 'взноса', 'взносов')}${thisMonth ? ` · в этом месяце ${formatMoney(thisMonth)}` : ''}` : 'Пока пусто'}
            </div>
          </section>

          <button type="button" className="plain-btn debt-pay" onClick={onNew}>
            <Plus size={20} /> Внести
          </button>

          {list.length > 0 && (
            <section className="section">
              <div className="section-title">Взносы</div>
              <div className="group">
                {list.map((s) => (
                  <button key={s.id} className="row" onClick={() => onEdit(s)}>
                    <span className="row-body">
                      <span className="row-title">{dayLabel(s.date, today)}</span>
                      {s.note && <span className="row-meta">{s.note}</span>}
                    </span>
                    <span className="money-amount">{s.amount < 0 ? '−' : '+'}{formatMoney(Math.abs(s.amount))}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

/** Шторка «Взнос»: сколько, когда, заметка */
export function SavingForm({ item, onClose }: { item?: Saving; onClose: () => void }) {
  useEscape(onClose)
  const today = todayKey()
  const [amount, setAmount] = useState(item ? String(item.amount).replace('.', ',') : '')
  const [date, setDate] = useState(item?.date ?? today)
  const [note, setNote] = useState(item?.note ?? '')

  const value = parseAmount(amount)
  const canSave = value !== null && !!date

  const save = () => {
    if (!canSave) return
    const draft = { amount: value, date, note: note.trim() }
    if (item) updateSaving(item.id, draft)
    else addSaving(draft)
    onClose()
  }

  const remove = () => {
    if (item && confirm(`Удалить взнос ${formatMoney(item.amount)}?`)) {
      deleteSaving(item.id)
      onClose()
    }
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item ? 'Взнос' : 'В копилку'} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button onClick={onClose}>{item ? 'Назад' : 'Отмена'}</button>
          <h2>{item ? 'Взнос' : 'В копилку'}</h2>
          <button onClick={save} disabled={!canSave}>Готово</button>
        </div>
        <form
          className="sheet-body"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="field-card">
            <label className="amount-input">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d\s.,]/g, ''))}
                placeholder="0"
                inputMode="decimal"
                autoFocus={!item}
                aria-label="Сумма"
                enterKeyHint="done"
              />
              <span>₽</span>
            </label>
          </div>

          <div className="section">
            <div className="section-title">Когда</div>
            <div className="group">
              <div className="form-row">
                <span><Calendar size={19} /> Дата</span>
                <input type="date" className="pill-input" value={date} max={addDays(today, 366)} onChange={(e) => setDate(e.target.value)} aria-label="Дата" />
              </div>
              <div className="form-row">
                <span />
                <div className="pills">
                  <button type="button" className={'pill' + (date === addDays(today, -1) ? ' on' : '')} onClick={() => setDate(addDays(today, -1))}>вчера</button>
                  <button type="button" className={'pill' + (date === today ? ' on' : '')} onClick={() => setDate(today)}>сегодня</button>
                </div>
              </div>
            </div>
          </div>

          <div className="field-card">
            <textarea className="note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка" rows={Math.max(1, note.split('\n').length)} />
          </div>

          {item && <button type="button" className="danger-btn" onClick={remove}>Удалить</button>}
          <button type="submit" hidden />
        </form>
      </div>
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

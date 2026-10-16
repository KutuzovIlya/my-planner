import { useEffect, useState } from 'react'
import { addDays, todayKey } from '../dates'
import { Calendar } from '../icons'
import { addIncome, deleteIncome, formatMoney, parseAmount, sourcesByTotal, updateIncome, useIncome, type Income } from '../money'

/** Шторка «Новый заработок» / «Заработок» */
export function IncomeForm({ item, initialSource, onClose }: { item?: Income; initialSource?: string; onClose: () => void }) {
  const today = todayKey()
  const all = useIncome()
  const [amount, setAmount] = useState(item ? String(item.amount).replace('.', ',') : '')
  const [source, setSource] = useState(item?.source ?? initialSource ?? '')
  const [date, setDate] = useState(item?.date ?? today)
  const [note, setNote] = useState(item?.note ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const value = parseAmount(amount)
  const canSave = value !== null && source.trim().length > 0 && !!date
  const suggestions = sourcesByTotal(all).slice(0, 8)

  const save = () => {
    if (!canSave) return
    const draft = { amount: value, source: source.trim(), date, note: note.trim() }
    if (item) updateIncome(item.id, draft)
    else addIncome(draft)
    onClose()
  }

  const remove = () => {
    if (item && confirm(`Удалить ${formatMoney(item.amount)} — «${item.source}»?`)) {
      deleteIncome(item.id)
      onClose()
    }
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item ? 'Заработок' : 'Новый заработок'} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button onClick={onClose}>Отмена</button>
          <h2>{item ? 'Заработок' : 'Новый заработок'}</h2>
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
                enterKeyHint="next"
              />
              <span>₽</span>
            </label>
          </div>

          <div className="section">
            <div className="section-title">Откуда</div>
            <div className="field-card">
              <input
                className="title-input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Зарплата, клиент, проект…"
                aria-label="Источник"
                enterKeyHint="done"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="pills" style={{ justifyContent: 'flex-start' }}>
                {suggestions.map((s) => (
                  <button type="button" key={s} className={'pill' + (s === source.trim() ? ' on' : '')} onClick={() => setSource(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
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
            <textarea
              className="note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Заметка"
              rows={Math.max(1, note.split('\n').length)}
            />
          </div>

          {item && <button type="button" className="danger-btn" onClick={remove}>Удалить</button>}
          <button type="submit" hidden />
        </form>
      </div>
    </div>
  )
}

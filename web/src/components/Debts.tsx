import { useEffect, useState } from 'react'
import { addDays, formatRelative, todayKey } from '../dates'
import { addDebt, deleteDebt, leftOf, paidOf, paymentsOf, sortDebts, updateDebt, useDebts, type Debt } from '../debts'
import { Calendar, Plus } from '../icons'
import { formatMoney, parseAmount, updateIncome, useIncome, type Income } from '../money'

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

const dayLabel = (d: string, today: string) =>
  d.slice(0, 4) === today.slice(0, 4) ? formatRelative(d, today) : `${formatRelative(d, today)} ${d.slice(0, 4)}`

/** Полоска «сколько уже вернули» */
function Progress({ debt, income }: { debt: Debt; income: Income[] }) {
  const paid = paidOf(debt, income)
  const pct = debt.amount > 0 ? Math.min(100, (paid / debt.amount) * 100) : 0
  return (
    <span className="money-source-bar debt-bar">
      <span style={{ width: `${pct}%` }} />
    </span>
  )
}

function progressText(debt: Debt, income: Income[]): string {
  const paid = paidOf(debt, income)
  const left = leftOf(debt, income)
  if (!left) return `вернул всё · ${formatMoney(debt.amount)}`
  if (!paid) return `пока ничего не вернул из ${formatMoney(debt.amount)}`
  return `вернул ${formatMoney(paid)} из ${formatMoney(debt.amount)}`
}

/** Шторка со списком должников */
export function DebtsSheet({ onClose, onOpen, onNew }: { onClose: () => void; onOpen: (d: Debt) => void; onNew: () => void }) {
  useEscape(onClose)
  const debts = useDebts()
  const income = useIncome()
  const sorted = sortDebts(debts, income)
  const active = sorted.filter((d) => leftOf(d, income) > 0)
  const closed = sorted.filter((d) => leftOf(d, income) === 0)
  const totalLeft = active.reduce((s, d) => s + leftOf(d, income), 0)

  const row = (d: Debt) => {
    const left = leftOf(d, income)
    return (
      <button key={d.id} className={'row money-source' + (left ? '' : ' done')} onClick={() => onOpen(d)}>
        <span className="row-body">
          <span className="money-source-head">
            <span className="row-title">{d.name}</span>
            <span className="money-source-sum">{left ? formatMoney(left) : '✓'}</span>
          </span>
          <Progress debt={d} income={income} />
          <span className="row-meta">{progressText(d, income)}</span>
        </span>
      </button>
    )
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Должники" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button onClick={onClose}>Закрыть</button>
          <h2>Должники</h2>
          <button onClick={onNew} aria-label="Добавить должника"><Plus size={22} /></button>
        </div>
        <div className="sheet-body">
          {debts.length === 0 ? (
            <div className="empty">
              <b>Никто не должен</b>
              Нажми «+», запиши, кто и сколько должен. Когда он вернёт часть — добавь поступление в «Деньгах» и отметь «в счёт долга».
            </div>
          ) : (
            <>
              <section className="money-total">
                <div className="money-period"><span>Тебе должны</span></div>
                <div className="money-sum">{formatMoney(totalLeft)}</div>
                <div className="money-sub">{active.length ? `${active.length} ${plural(active.length, 'должник', 'должника', 'должников')}` : 'Все долги вернули'}</div>
              </section>
              {active.length > 0 && <div className="group">{active.map(row)}</div>}
              {closed.length > 0 && (
                <section className="section">
                  <div className="section-title">Вернули</div>
                  <div className="group">{closed.map(row)}</div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Шторка «Новый должник» / карточка должника с возвратами */
export function DebtForm({
  debt,
  onClose,
  onPayment,
  onEditPayment,
}: {
  debt?: Debt
  onClose: () => void
  onPayment: (d: Debt) => void
  onEditPayment: (i: Income) => void
}) {
  useEscape(onClose)
  const today = todayKey()
  const income = useIncome()
  const [amount, setAmount] = useState(debt ? String(debt.amount).replace('.', ',') : '')
  const [name, setName] = useState(debt?.name ?? '')
  const [date, setDate] = useState(debt?.date ?? today)
  const [note, setNote] = useState(debt?.note ?? '')

  const value = parseAmount(amount)
  const canSave = value !== null && name.trim().length > 0 && !!date
  const draft = () => ({ amount: value!, name: name.trim(), date, note: note.trim() })
  const dirty = !!debt && canSave && (value !== debt.amount || name.trim() !== debt.name || date !== debt.date || note.trim() !== debt.note)

  const save = () => {
    if (!canSave) return
    if (debt) updateDebt(debt.id, draft())
    else addDebt(draft())
    onClose()
  }

  const payment = () => {
    if (!debt) return
    if (dirty) updateDebt(debt.id, draft())
    onPayment(debt)
  }

  const remove = () => {
    if (!debt) return
    const payments = paymentsOf(debt, income)
    const msg = payments.length
      ? `Удалить должника «${debt.name}»? Возвраты останутся в «Деньгах» как обычные поступления.`
      : `Удалить должника «${debt.name}»?`
    if (!confirm(msg)) return
    for (const p of payments) updateIncome(p.id, { debtId: undefined })
    deleteDebt(debt.id)
    onClose()
  }

  const payments = debt ? [...paymentsOf(debt, income)].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt) : []
  const left = debt ? leftOf(debt, income) : 0

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={debt ? debt.name : 'Новый должник'} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button onClick={onClose}>{debt ? 'Назад' : 'Отмена'}</button>
          <h2>{debt ? 'Должник' : 'Новый должник'}</h2>
          <button onClick={save} disabled={!canSave}>Готово</button>
        </div>

        <form
          className="sheet-body"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {debt && (
            <section className="money-total">
              <div className="money-period"><span>{left ? 'Осталось вернуть' : 'Долг вернули'}</span></div>
              <div className="money-sum">{formatMoney(left || debt.amount)}</div>
              <div className="debt-progress">
                <Progress debt={debt} income={income} />
              </div>
              <div className="money-sub">{progressText(debt, income)}</div>
            </section>
          )}

          {debt && (
            <button type="button" className="plain-btn debt-pay" onClick={payment}>
              <Plus size={20} /> Записать возврат
            </button>
          )}

          {payments.length > 0 && (
            <section className="section">
              <div className="section-title">Возвраты</div>
              <div className="group">
                {payments.map((i) => (
                  <button type="button" key={i.id} className="row" onClick={() => onEditPayment(i)}>
                    <span className="row-body">
                      <span className="row-title">{dayLabel(i.date, today)}</span>
                      {i.note && <span className="row-meta">{i.note}</span>}
                    </span>
                    <span className="money-amount">{formatMoney(i.amount)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="section">
            <div className="section-title">{debt ? 'Сколько был должен' : 'Сколько должен'}</div>
            <div className="field-card">
              <label className="amount-input">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d\s.,]/g, ''))}
                  placeholder="0"
                  inputMode="decimal"
                  autoFocus={!debt}
                  aria-label="Сумма долга"
                  enterKeyHint="next"
                />
                <span>₽</span>
              </label>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Кто</div>
            <div className="field-card">
              <input className="title-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" aria-label="Кто должен" enterKeyHint="done" />
            </div>
          </div>

          <div className="section">
            <div className="section-title">Когда дал в долг</div>
            <div className="group">
              <div className="form-row">
                <span><Calendar size={19} /> Дата</span>
                <input type="date" className="pill-input" value={date} max={addDays(today, 366)} onChange={(e) => setDate(e.target.value)} aria-label="Дата" />
              </div>
            </div>
          </div>

          <div className="field-card">
            <textarea className="note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка" rows={Math.max(1, note.split('\n').length)} />
          </div>

          {debt && <button type="button" className="danger-btn" onClick={remove}>Удалить должника</button>}
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

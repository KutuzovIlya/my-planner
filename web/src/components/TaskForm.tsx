import { useEffect, useState } from 'react'
import { addDays, inputToTime, timeToInput, todayKey } from '../dates'
import { Bell, Calendar, Clock, Repeat as RepeatIcon } from '../icons'
import { REMIND_OPTIONS, remindLabel, usePrefs } from '../prefs'
import { addCategory, catClass, useCategories } from '../categories'
import { addTask, deleteTask, REPEATS, toggleDone, updateTask, type Category, type Repeat, type Task, type TaskDraft } from '../store'
import { CategoriesSheet, CategoryEditor } from './Categories'

const DURATIONS = [15, 30, 60, 90, 120, 180]
const durLabel = (m: number) => (m < 60 ? `${m} м` : `${m / 60} ч`.replace('.', ','))

function nextHour(): number {
  const d = new Date()
  return Math.min(23, d.getHours() + 1) * 60
}

/** Шторка «Новое дело» / «Изменить дело» по макету AddItem */
export function TaskForm({ task, initial, day, onClose }: {
  task?: Task
  initial?: Partial<TaskDraft>
  /** день, для которого отмечаем повторяющееся дело */
  day?: string
  onClose: () => void
}) {
  const src = task ?? initial ?? {}
  const today = todayKey()
  const [title, setTitle] = useState(src.title ?? '')
  const [note, setNote] = useState(src.note ?? '')
  const [category, setCategory] = useState<Category>(src.category ?? 'personal')
  const [date, setDate] = useState<string | null>(src.date ?? null)
  const [start, setStart] = useState<number | null>(src.start ?? null)
  const [duration, setDuration] = useState(src.duration ?? 60)
  const [repeat, setRepeat] = useState<Repeat>(src.repeat ?? 'none')
  const categories = useCategories()
  const prefs = usePrefs()
  const [remind, setRemind] = useState<number | null | undefined>(src.remind)
  const [newCat, setNewCat] = useState(false)
  const [manageCats, setManageCats] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canSave = title.trim().length > 0

  const save = () => {
    if (!canSave) return
    const draft: TaskDraft = {
      title: title.trim(),
      note: note.trim(),
      category,
      // у повторяющегося или привязанного ко времени дела должна быть дата
      date: date ?? (repeat !== 'none' || start !== null ? today : null),
      start,
      duration,
      repeat,
      remind,
    }
    if (task) updateTask(task.id, draft)
    else addTask(draft)
    onClose()
  }

  const remove = () => {
    if (task && confirm(`Удалить «${task.title}»?`)) {
      deleteTask(task.id)
      onClose()
    }
  }

  const doneDay = day ?? today
  const isDone = task ? (task.repeat === 'none' ? task.done : task.doneDates.includes(doneDay)) : false

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={task ? 'Изменить дело' : 'Новое дело'} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button onClick={onClose}>Отмена</button>
          <h2>{task ? 'Дело' : 'Новое дело'}</h2>
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
            <input
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Что нужно сделать?"
              autoFocus={!task}
              enterKeyHint="done"
            />
            <div className="hr" />
            <textarea
              className="note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Заметка"
              rows={Math.max(1, note.split('\n').length)}
            />
          </div>

          <div className="section">
            <div className="section-title">
              <span>Категория</span>
              <button type="button" className="link-btn" onClick={() => setManageCats(true)}>Изменить</button>
            </div>
            <div className="cat-chips">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`cat-chip ${catClass(c.id)}` + (category === c.id ? ' on' : '')}
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                >
                  <span className="dot" />
                  {c.label}
                </button>
              ))}
              {!newCat && (
                <button type="button" className="cat-chip add" onClick={() => setNewCat(true)}>+ своя</button>
              )}
            </div>
            {newCat && (
              <div className="group">
                <CategoryEditor
                  onCancel={() => setNewCat(false)}
                  onSave={(label, color) => {
                    setCategory(addCategory(label, color).id)
                    setNewCat(false)
                  }}
                />
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title">Когда</div>
            <div className="group">
              <div className="form-row">
                <span><Calendar size={19} /> Дата</span>
                <input
                  type="date"
                  className="pill-input"
                  value={date ?? ''}
                  onChange={(e) => setDate(e.target.value || null)}
                  aria-label="Дата"
                />
              </div>
              <div className="form-row">
                <span />
                <div className="pills">
                  <button type="button" className={'pill' + (date === null ? ' on' : '')} onClick={() => { setDate(null); setStart(null) }}>без даты</button>
                  <button type="button" className={'pill' + (date === today ? ' on' : '')} onClick={() => setDate(today)}>сегодня</button>
                  <button type="button" className={'pill' + (date === addDays(today, 1) ? ' on' : '')} onClick={() => setDate(addDays(today, 1))}>завтра</button>
                </div>
              </div>
              <div className="form-row">
                <span><Clock size={19} /> Начало</span>
                {start === null ? (
                  <button type="button" className="pill" onClick={() => { setStart(nextHour()); if (!date) setDate(today) }}>
                    без времени
                  </button>
                ) : (
                  <div className="pills">
                    <input
                      type="time"
                      className="pill-input"
                      value={timeToInput(start)}
                      onChange={(e) => setStart(inputToTime(e.target.value))}
                      aria-label="Время начала"
                    />
                    <button type="button" className="pill" onClick={() => setStart(null)} aria-label="Убрать время">✕</button>
                  </div>
                )}
              </div>
              {start !== null && (
                <div className="form-row">
                  <span>Длительность</span>
                  <div className="pills">
                    {DURATIONS.map((m) => (
                      <button type="button" key={m} className={'pill' + (duration === m ? ' on' : '')} onClick={() => setDuration(m)}>
                        {durLabel(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="hint">Без времени дело попадёт в полоску над сеткой дня</div>
          </div>

          <div className="section">
            <div className="section-title">Повтор и напоминание</div>
            <div className="group">
              <div className="form-row">
                <span><RepeatIcon size={19} /> Повторять</span>
                <select className="pill-input" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} aria-label="Повтор">
                  {REPEATS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
              {start !== null && (
                <div className="form-row">
                  <span><Bell /> Напомнить</span>
                  <select
                    className="pill-input"
                    value={remind === undefined ? 'default' : String(remind)}
                    onChange={(e) => setRemind(e.target.value === 'default' ? undefined : e.target.value === 'null' ? null : Number(e.target.value))}
                    aria-label="Напомнить"
                  >
                    <option value="default">как обычно ({remindLabel(prefs.defaultRemind)})</option>
                    {REMIND_OPTIONS.map((o) => (
                      <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {task && (
            <div className="section">
              <button
                type="button"
                className="plain-btn"
                onClick={() => {
                  toggleDone(task.id, doneDay)
                  onClose()
                }}
              >
                {isDone ? 'Вернуть в работу' : 'Отметить выполненным'}
              </button>
              <button type="button" className="danger-btn" onClick={remove}>Удалить дело</button>
            </div>
          )}
          <button type="submit" hidden />
        </form>
        {manageCats && <CategoriesSheet onClose={() => setManageCats(false)} />}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { formatDuration, formatRelative, formatTime, todayKey } from '../dates'
import { ArrowUp, Mic, Repeat as RepeatIcon, Stop } from '../icons'
import { parseQuick } from '../parse'
import { speechSupported, useSpeech } from '../speech'
import { addTask, categoryLabel, REPEATS } from '../store'

const DEFAULT_DURATION = 60

/** Строка быстрого ввода: «Спортзал завтра в 18 1ч #здоровье» */
export function QuickAdd({ defaultDate }: { defaultDate?: string }) {
  const [text, setText] = useState('')
  const speech = useSpeech(setText)
  const today = todayKey()
  const parsed = text.trim() ? parseQuick(text, today) : null

  // Без явной даты: на экране дня — этот день; с временем или повтором — сегодня; иначе «без срока»
  const date = parsed
    ? parsed.date ?? defaultDate ?? (parsed.start !== null || parsed.repeat !== 'none' ? today : null)
    : null

  const submit = () => {
    if (!parsed?.title) return
    addTask({
      title: parsed.title,
      note: '',
      category: parsed.category ?? 'personal',
      date,
      start: parsed.start,
      duration: parsed.duration ?? DEFAULT_DURATION,
      repeat: parsed.repeat,
    })
    setText('')
  }

  const showPreview = parsed && (parsed.date || parsed.start !== null || parsed.duration || parsed.category || parsed.repeat !== 'none')

  return (
    <div className="quick">
      <form
        className="quick-row"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            speech.clearError()
          }}
          placeholder={speech.listening ? 'Говори…' : speechSupported ? 'Новое дело — напиши или скажи' : 'Новое дело: «Врач завтра в 15»'}
          enterKeyHint="done"
          aria-label="Быстро добавить дело"
        />
        {speech.listening ? (
          <button className="send-btn mic on" type="button" onClick={speech.stop} aria-label="Остановить запись">
            <Stop />
          </button>
        ) : speechSupported && !text.trim() ? (
          <button className="send-btn mic" type="button" onClick={speech.start} aria-label="Сказать голосом">
            <Mic />
          </button>
        ) : (
          <button className="send-btn" type="submit" disabled={!parsed?.title} aria-label="Добавить">
            <ArrowUp />
          </button>
        )}
      </form>
      {speech.error && <div className="quick-preview"><span className="tag" style={{ color: 'var(--red)' }}>{speech.error}</span></div>}
      {showPreview && (
        <div className="quick-preview">
          {date && <span className="tag">{formatRelative(date, today)}</span>}
          {parsed.start !== null && (
            <span className="tag">
              {formatTime(parsed.start)} – {formatTime(parsed.start + (parsed.duration ?? DEFAULT_DURATION))}
            </span>
          )}
          {parsed.start === null && parsed.duration && <span className="tag">{formatDuration(parsed.duration)}</span>}
          {parsed.repeat !== 'none' && (
            <span className="tag">
              <RepeatIcon size={11} /> {REPEATS.find((r) => r.id === parsed.repeat)!.label}
            </span>
          )}
          {parsed.category && (
            <span className={`tag cat-${parsed.category}`}>
              <span className="dot" /> {categoryLabel(parsed.category)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

// Голосовой ввод: Web Speech API (webkitSpeechRecognition) — в Safari это бесплатное
// распознавание Apple, в Chrome — Google. Если не работает (ошибка, не запустилось,
// ничего не услышало) — подсказываем диктовку с клавиатуры и показываем код ошибки.

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

const Ctor: (new () => Recognition) | undefined =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
    : undefined

const isIOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** Кнопка микрофона есть всегда: либо распознавание браузера, либо подсказка про клавиатуру */
export const voiceAvailable = !!Ctor || isIOS || /Android/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')

export const KEYBOARD_HINT = 'Нажми 🎤 на клавиатуре и говори — текст появится в строке'

const ERRORS: Record<string, string> = {
  'not-allowed': 'Нет доступа к микрофону — разреши его для «Планер» в настройках телефона. ',
  'service-not-allowed': isIOS
    ? 'iPhone не дал распознавание речи: проверь, что включены Siri и диктовка («Настройки» → «Основные» → «Клавиатура» → «Диктовка»). '
    : 'Распознавание речи в браузере недоступно. ',
  'audio-capture': 'Микрофон не найден. ',
  network: 'Нет сети для распознавания. ',
  'no-speech': 'Ничего не услышал — говори сразу после нажатия. ',
}

// с запасом: при первом запуске iPhone спрашивает разрешение на микрофон
const START_TIMEOUT = 10000

/**
 * Диктовка: onText получает текст по мере распознавания.
 * focusInput — открыть клавиатуру, если переходим на диктовку с клавиатуры.
 */
export function useSpeech(onText: (text: string) => void, focusInput: () => void) {
  const [listening, setListening] = useState(false)
  const [hint, setHint] = useState<{ text: string; error: boolean } | null>(null)
  const rec = useRef<Recognition | null>(null)
  const cb = useRef({ onText, focusInput })
  cb.current = { onText, focusInput }

  useEffect(() => () => rec.current?.abort(), [])

  /** Перейти на диктовку с клавиатуры */
  const fallback = (reason = '') => {
    setListening(false)
    setHint({ text: reason + KEYBOARD_HINT, error: !!reason })
    cb.current.focusInput()
  }

  const start = () => {
    if (listening) return
    setHint(null)
    if (!Ctor) return fallback()

    let started = false
    let heard = false
    let failed = false
    const r = new Ctor()
    r.lang = 'ru-RU'
    r.interimResults = true
    r.continuous = false
    const watchdog = window.setTimeout(() => {
      if (started) return
      failed = true
      r.abort()
      fallback('Микрофон не запустился. ')
    }, START_TIMEOUT)

    r.onstart = () => {
      started = true
    }
    r.onresult = (e) => {
      heard = true
      // Без continuous распознаётся одна фраза. Safari на iPhone присылает каждый
      // промежуточный вариант отдельным результатом, и каждый уже содержит предыдущие —
      // склейка всех давала повторы («Врач Врач завтра…»). Берём последний, самый полный.
      const last = e.results[e.results.length - 1]
      cb.current.onText(last[0].transcript.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'aborted' || failed) return
      failed = true
      clearTimeout(watchdog)
      fallback(ERRORS[e.error] ?? `Не удалось распознать речь (${e.error}). `)
    }
    r.onend = () => {
      clearTimeout(watchdog)
      rec.current = null
      if (failed) return
      setListening(false)
      // закончилось молча: ни текста, ни ошибки (так бывает в iOS)
      if (!heard) fallback('Ничего не распознано. ')
    }
    rec.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      clearTimeout(watchdog)
      failed = true
      fallback('Не удалось включить микрофон. ')
    }
  }

  const stop = () => rec.current?.stop()

  return { listening, hint, start, stop, clearHint: () => setHint(null) }
}

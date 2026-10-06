import { useEffect, useRef, useState } from 'react'

// Голосовой ввод. Два пути:
//  1) Web Speech API (webkitSpeechRecognition) — в Chrome и Safari;
//  2) диктовка с клавиатуры (🎤 на клавиатуре iPhone) — запасной путь: в приложении
//     с экрана «Домой» iOS часто не даёт Web Speech API работать, а диктовка работает всегда.

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
const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

/** Пользоваться ли распознаванием браузера (иначе — диктовка с клавиатуры) */
const useWebSpeech = !!Ctor && !(isIOS && isStandalone)

/** Кнопка микрофона есть всегда: либо распознавание браузера, либо подсказка про клавиатуру */
export const voiceAvailable = useWebSpeech || isIOS || /Android/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')

export const KEYBOARD_HINT = 'Нажми 🎤 на клавиатуре и говори — текст появится в строке'

const ERRORS: Record<string, string> = {
  'not-allowed': 'Нет доступа к микрофону. ',
  'service-not-allowed': 'Распознавание речи в браузере недоступно. ',
  'audio-capture': 'Микрофон не найден. ',
  network: 'Нет сети для распознавания. ',
  'no-speech': 'Ничего не услышал. ',
}

const START_TIMEOUT = 4000

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
    if (!useWebSpeech || !Ctor) return fallback()

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
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      cb.current.onText(text.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'aborted' || failed) return
      failed = true
      clearTimeout(watchdog)
      fallback(ERRORS[e.error] ?? 'Не удалось распознать речь. ')
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

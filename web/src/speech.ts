import { useEffect, useRef, useState } from 'react'

// Web Speech API: в Safari и Chrome есть как webkitSpeechRecognition, типов в lib.dom нет
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
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

export const speechSupported = !!Ctor

const ERRORS: Record<string, string> = {
  'not-allowed': 'Нет доступа к микрофону — разреши его в настройках браузера',
  'service-not-allowed': 'Распознавание речи недоступно — попробуй микрофон на клавиатуре',
  'no-speech': 'Ничего не услышал, попробуй ещё раз',
  'audio-capture': 'Микрофон не найден',
  network: 'Нет сети для распознавания речи',
}

/** Диктовка: onText получает текст по мере распознавания */
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const cb = useRef(onText)
  cb.current = onText

  useEffect(() => () => rec.current?.abort(), [])

  const start = () => {
    if (!Ctor || listening) return
    setError(null)
    const r = new Ctor()
    r.lang = 'ru-RU'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      cb.current(text.trim())
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Не удалось распознать речь')
    }
    r.onend = () => {
      setListening(false)
      rec.current = null
    }
    rec.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
      setError('Не удалось включить микрофон')
    }
  }

  const stop = () => rec.current?.stop()

  return { listening, error, start, stop, clearError: () => setError(null) }
}

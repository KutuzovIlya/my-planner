import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

/**
 * Горизонтальный свайп для листания (дней, недель): влево — вперёд, вправо — назад.
 * Жесты, начатые на делах (.swipe) и полях ввода, игнорируются.
 */
export function usePager(onPage: (dir: 1 | -1) => void) {
  const g = useRef<{ x: number; y: number; mode: 'h' | 'v' | null } | null>(null)
  const suppressClick = useRef(false)
  const [dragX, setDragX] = useState(0)

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.swipe, input, textarea, select')) return
      g.current = { x: e.clientX, y: e.clientY, mode: null }
      suppressClick.current = false
    },
    onPointerMove: (e: PointerEvent) => {
      const s = g.current
      if (!s) return
      const mx = e.clientX - s.x
      const my = e.clientY - s.y
      if (!s.mode && Math.hypot(mx, my) > 10) {
        s.mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'h' : 'v'
        if (s.mode === 'h') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }
      if (s.mode === 'h') setDragX(mx)
    },
    onPointerUp: () => {
      const s = g.current
      g.current = null
      if (s?.mode) suppressClick.current = true
      if (s?.mode === 'h' && Math.abs(dragX) > 60) onPage(dragX < 0 ? 1 : -1)
      setDragX(0)
    },
    onPointerCancel: () => {
      g.current = null
      setDragX(0)
    },
    onClickCapture: (e: MouseEvent) => {
      if (suppressClick.current) {
        e.stopPropagation()
        e.preventDefault()
        suppressClick.current = false
      }
    },
  }

  const pageStyle: CSSProperties | undefined = dragX
    ? { transform: `translateX(${dragX * 0.6}px)`, opacity: 1 - Math.min(0.4, Math.abs(dragX) / 600), animation: 'none' }
    : undefined

  return { handlers, pageStyle }
}

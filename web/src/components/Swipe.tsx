import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Check } from '../icons'

const THRESHOLD = 70

/**
 * Свайп вправо — «сделано». Обычный клик проходит к содержимому,
 * а клик сразу после свайпа гасится.
 */
export function Swipe({ onSwipe, children, className = '', style }: {
  onSwipe: () => void
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const g = useRef<{ x: number; y: number; mode: 'h' | 'v' | null } | null>(null)
  const suppressClick = useRef(false)
  const [dx, setDx] = useState(0)

  const reset = () => {
    g.current = null
    setDx(0)
  }

  return (
    <div
      className={'swipe ' + className}
      style={style}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        g.current = { x: e.clientX, y: e.clientY, mode: null }
        suppressClick.current = false
      }}
      onPointerMove={(e) => {
        const s = g.current
        if (!s) return
        const mx = e.clientX - s.x
        const my = e.clientY - s.y
        if (!s.mode && Math.hypot(mx, my) > 8) {
          s.mode = Math.abs(mx) > Math.abs(my) && mx > 0 ? 'h' : 'v'
          if (s.mode === 'h') e.currentTarget.setPointerCapture(e.pointerId)
        }
        if (s.mode === 'h') setDx(Math.max(0, Math.min(mx, 140)))
      }}
      onPointerUp={() => {
        const s = g.current
        if (s?.mode) suppressClick.current = true
        if (s?.mode === 'h' && dx >= THRESHOLD) onSwipe()
        reset()
      }}
      onPointerCancel={reset}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation()
          e.preventDefault()
          suppressClick.current = false
        }
      }}
    >
      <div className="swipe-bg" style={{ opacity: Math.min(1, dx / THRESHOLD) }}>
        <Check size={16} />
      </div>
      <div
        className="swipe-content"
        style={{ height: '100%', transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 0.2s' }}
      >
        {children}
      </div>
    </div>
  )
}

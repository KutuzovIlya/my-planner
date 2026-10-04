import { useEffect, useRef, type RefObject } from 'react'

const HOLD_MS = 400
const MOVE_TOLERANCE = 8

/**
 * Зажал → тащишь по вертикали. Пока тащишь, прокрутка заблокирована
 * (preventDefault на touchmove), без зажатия — обычный скролл.
 * Колбэки получают clientY и clientX пальца.
 */
export function useLongPressDrag(
  ref: RefObject<HTMLElement | null>,
  handlers: { onStart: (y: number, x: number) => void; onMove: (y: number, x: number) => void; onEnd: (y: number | null, x: number) => void },
) {
  const h = useRef(handlers)
  h.current = handlers

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer = 0
    let active = false
    let x0 = 0
    let y0 = 0
    let lastY = 0
    let lastX = 0
    let suppressClick = false

    const begin = (x: number, y: number) => {
      x0 = x
      y0 = y
      lastY = y
      lastX = x
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        active = true
        suppressClick = true
        navigator.vibrate?.(10)
        h.current.onStart(y0, x0)
      }, HOLD_MS)
    }
    const move = (x: number, y: number) => {
      lastY = y
      lastX = x
      if (active) h.current.onMove(y, x)
      else if (Math.hypot(x - x0, y - y0) > MOVE_TOLERANCE) clearTimeout(timer)
    }
    const finish = (cancelled: boolean) => {
      clearTimeout(timer)
      if (active) h.current.onEnd(cancelled ? null : lastY, lastX)
      active = false
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) begin(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (active) e.preventDefault() // держим дело — экран не двигается
      move(t.clientX, t.clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (active) e.preventDefault() // без «клика» после перетаскивания
      finish(false)
    }
    const onTouchCancel = () => finish(true)

    // мышь (компьютер): то же самое через mousedown + удержание
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY)
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      finish(false)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      suppressClick = false
      begin(e.clientX, e.clientY)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    const onClick = (e: MouseEvent) => {
      if (suppressClick) {
        e.stopPropagation()
        e.preventDefault()
        suppressClick = false
      }
    }
    const onContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    el.addEventListener('touchcancel', onTouchCancel)
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('click', onClick, true)
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [ref])
}

import { useState } from 'react'
import { CategoriesSheet } from '../components/Categories'
import { getCategories, useCategories } from '../categories'
import { timeToInput, inputToTime } from '../dates'
import { ChevronRight } from '../icons'
import { getPrefs, REMIND_OPTIONS, setPrefs, usePrefs } from '../prefs'
import { getTasks, useTasks } from '../store'
import { supabaseConfigured } from '../supabase'
import { useSync } from '../sync'

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

/** Можно ли здесь включить уведомления и что подсказать, если нельзя */
function notificationSupport(): { ok: boolean; hint?: string } {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    if (isIOS() && !isStandalone()) return { ok: false, hint: 'На iPhone уведомления работают, только если открыть планер с экрана «Домой»: «Поделиться» → «На экран „Домой“»' }
    return { ok: false, hint: 'Этот браузер не поддерживает уведомления' }
  }
  if (Notification.permission === 'denied') return { ok: false, hint: 'Уведомления запрещены — разреши их в настройках телефона для «Планер»' }
  return { ok: true }
}

function exportData() {
  const data = { app: 'planner', version: 1, exportedAt: new Date().toISOString(), tasks: getTasks(), categories: getCategories(), prefs: getPrefs() }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `planner-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function Settings({ onAccount }: { onAccount: () => void }) {
  const prefs = usePrefs()
  const categories = useCategories()
  const tasks = useTasks()
  const { session, status } = useSync()
  const [showCats, setShowCats] = useState(false)
  const [notifHint, setNotifHint] = useState<string | null>(null)
  const hours = Array.from({ length: 25 }, (_, i) => i)

  const toggleNotifications = async (on: boolean) => {
    setNotifHint(null)
    if (!on) return setPrefs({ notifications: false })
    const support = notificationSupport()
    if (!support.ok) return setNotifHint(support.hint ?? null)
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return setNotifHint('Без разрешения уведомления не придут — разреши их, когда телефон спросит')
    setPrefs({ notifications: true })
  }

  return (
    <>
      <header className="header">
        <div className="title">Настройки</div>
      </header>

      <div className="scroll">
        <div className="task-list">
          {supabaseConfigured && (
            <section className="section">
              <div className="section-title">Аккаунт</div>
              <div className="group">
                <button className="row" onClick={onAccount}>
                  <div className="avatar small">{session?.user.email?.[0]?.toUpperCase() ?? '?'}</div>
                  <span className="row-body">
                    <span className="row-title">{session?.user.email ?? 'Войти или создать аккаунт'}</span>
                    <span className="row-meta">
                      {session ? (status === 'synced' ? 'Всё сохранено в облаке' : status === 'syncing' ? 'Синхронизация…' : status === 'offline' ? 'Нет сети' : 'Ошибка синхронизации') : 'Дела хранятся только на этом устройстве'}
                    </span>
                  </span>
                  <span style={{ color: 'var(--label-4)' }}><ChevronRight size={18} /></span>
                </button>
              </div>
            </section>
          )}

          <section className="section">
            <div className="section-title">Уведомления</div>
            <div className="group">
              <div className="form-row">
                <span>Напоминания о делах</span>
                <Toggle label="Напоминания о делах" on={prefs.notifications} onChange={(v) => void toggleNotifications(v)} />
              </div>
              <div className="form-row">
                <span>Напоминать</span>
                <select
                  className="pill-input"
                  value={String(prefs.defaultRemind)}
                  disabled={!prefs.notifications}
                  onChange={(e) => setPrefs({ defaultRemind: e.target.value === 'null' ? null : Number(e.target.value) })}
                  aria-label="За сколько напоминать"
                >
                  {REMIND_OPTIONS.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <span>Утренний план дня</span>
                <Toggle label="Утренний план дня" on={prefs.morningPlan} disabled={!prefs.notifications} onChange={(v) => setPrefs({ morningPlan: v })} />
              </div>
              {prefs.morningPlan && (
                <div className="form-row">
                  <span>Во сколько</span>
                  <input
                    type="time"
                    className="pill-input"
                    value={timeToInput(prefs.morningTime)}
                    disabled={!prefs.notifications}
                    onChange={(e) => {
                      const t = inputToTime(e.target.value)
                      if (t !== null) setPrefs({ morningTime: t })
                    }}
                    aria-label="Время утреннего плана"
                  />
                </div>
              )}
            </div>
            {notifHint ? (
              <div className="hint" style={{ color: 'var(--red)' }}>{notifHint}</div>
            ) : (
              <div className="hint">
                {supabaseConfigured
                  ? 'Время напоминания можно поменять в каждом деле. Утренний план — список дел на день.'
                  : 'Пуши начнут приходить после подключения сервера — настройки сохранятся.'}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section-title">Категории</div>
            <div className="group">
              <button className="row" onClick={() => setShowCats(true)}>
                <span className="row-body">
                  <span className="row-title">Категории</span>
                  <span className="cat-dots">
                    {categories.map((c) => <span key={c.id} className={`dot cc-${c.color}`} />)}
                  </span>
                </span>
                <span className="row-meta">{categories.length}</span>
                <span style={{ color: 'var(--label-4)' }}><ChevronRight size={18} /></span>
              </button>
            </div>
          </section>

          <section className="section">
            <div className="section-title">Сетка дня</div>
            <div className="group">
              <div className="form-row">
                <span>Начало дня</span>
                <select className="pill-input" value={prefs.dayStart} onChange={(e) => setPrefs({ dayStart: Number(e.target.value) })} aria-label="Начало дня">
                  {hours.filter((h) => h < prefs.dayEnd).map((h) => <option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
              <div className="form-row">
                <span>Конец дня</span>
                <select className="pill-input" value={prefs.dayEnd} onChange={(e) => setPrefs({ dayEnd: Number(e.target.value) })} aria-label="Конец дня">
                  {hours.filter((h) => h > prefs.dayStart).map((h) => <option key={h} value={h}>{h === 24 ? '0:00' : `${h}:00`}</option>)}
                </select>
              </div>
            </div>
            <div className="hint">Дела вне этих часов всё равно видны — сетка расширится</div>
          </section>

          <section className="section">
            <div className="section-title">Данные</div>
            <div className="group">
              <button className="row" onClick={exportData}>
                <span className="row-body">
                  <span className="row-title" style={{ color: 'var(--accent)' }}>Скачать резервную копию</span>
                  <span className="row-meta">Все дела ({tasks.length}), категории и настройки одним файлом</span>
                </span>
              </button>
            </div>
          </section>

          <div className="hint" style={{ textAlign: 'center', paddingTop: 8 }}>Планер · версия {__BUILD_ID__}</div>
        </div>
      </div>

      {showCats && <CategoriesSheet onClose={() => setShowCats(false)} />}
    </>
  )
}

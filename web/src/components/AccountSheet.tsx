import { useEffect, useState } from 'react'
import { pendingCount, signOut, sync, useSync } from '../sync'
import { AuthForm } from './AuthForm'

function statusText(status: string, lastSync: number | null): string {
  if (status === 'syncing') return 'Синхронизация…'
  if (status === 'offline') return 'Нет сети — изменения сохранятся, когда она появится'
  if (status === 'error') return 'Не получилось синхронизировать — попробуем ещё'
  if (lastSync) {
    const t = new Date(lastSync)
    return `Всё сохранено в облаке · ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`
  }
  return 'Сохранено'
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { session, status, lastSync } = useSync()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const logout = async () => {
    const unsent = pendingCount()
    const warn = unsent ? `\n\n${unsent} изменений ещё не отправлено — без сети они потеряются.` : ''
    if (!confirm(`Выйти из аккаунта? Дела останутся в облаке, а с этого устройства уберутся.${warn}`)) return
    setBusy(true)
    await signOut()
    setBusy(false)
    onClose()
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Аккаунт" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span style={{ minWidth: 70 }} />
          <h2>Аккаунт</h2>
          <button onClick={onClose}>Готово</button>
        </div>
        <div className="sheet-body">
          {session ? (
            <>
              <div className="field-card account-card">
                <div className="avatar">{session.user.email?.[0]?.toUpperCase() ?? '?'}</div>
                <div className="row-body">
                  <span className="row-title">{session.user.email}</span>
                  <span className="row-meta">{statusText(status, lastSync)}</span>
                </div>
              </div>
              <div className="section">
                <button className="plain-btn" onClick={() => void sync()} disabled={status === 'syncing'}>Синхронизировать сейчас</button>
                <button className="danger-btn" onClick={logout} disabled={busy}>Выйти</button>
              </div>
            </>
          ) : (
            <>
              <div className="hint" style={{ fontSize: 14 }}>
                Войди, чтобы дела хранились в облаке и были на всех твоих устройствах. Дела, которые уже есть, перенесутся в аккаунт.
              </div>
              <AuthForm />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

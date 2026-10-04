import { useState } from 'react'
import { resetPassword, signIn, signUp, updatePassword } from '../sync'

type Mode = 'signin' | 'signup' | 'reset' | 'newpass'

/** Вход / регистрация / сброс пароля */
export function AuthForm({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null)

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    let err: string | null = null
    if (mode === 'signin') err = await signIn(email, password)
    else if (mode === 'signup') err = await signUp(email, password)
    else if (mode === 'newpass') err = await updatePassword(password)
    else {
      err = await resetPassword(email)
      if (!err) {
        setMessage({ text: 'Письмо со ссылкой для нового пароля отправлено на почту', ok: true })
        setBusy(false)
        return
      }
    }
    if (err) setMessage({ text: err, ok: err.startsWith('Мы отправили') })
    setBusy(false)
  }

  const needEmail = mode !== 'newpass'
  const needPass = mode !== 'reset'
  const canSubmit = !busy && (!needEmail || /\S+@\S+\.\S+/.test(email)) && (!needPass || password.length >= (mode === 'signin' ? 1 : 8))

  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) void submit()
      }}
    >
      {(mode === 'signin' || mode === 'signup') && (
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setMessage(null) }}>Вход</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setMessage(null) }}>Регистрация</button>
        </div>
      )}
      {mode === 'reset' && <div className="auth-hint">Пришлём ссылку, по которой можно задать новый пароль</div>}
      {mode === 'newpass' && <div className="auth-hint">Придумай новый пароль</div>}

      <div className="group">
        {needEmail && (
          <input
            className="auth-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="Почта"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        {needPass && (
          <div className="auth-pass">
            <input
              className="auth-input"
              type={showPass ? 'text' : 'password'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signin' ? 'Пароль' : 'Пароль: от 8 символов, буквы и цифры'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="link-btn" onClick={() => setShowPass(!showPass)}>{showPass ? 'скрыть' : 'показать'}</button>
          </div>
        )}
      </div>

      {message && <div className={'auth-message' + (message.ok ? ' ok' : '')}>{message.text}</div>}

      <button type="submit" className="primary-btn" disabled={!canSubmit}>
        {busy ? '…' : mode === 'signin' ? 'Войти' : mode === 'signup' ? 'Создать аккаунт' : mode === 'reset' ? 'Отправить ссылку' : 'Сохранить пароль'}
      </button>

      {mode === 'signin' && <button type="button" className="link-btn center" onClick={() => { setMode('reset'); setMessage(null) }}>Забыли пароль?</button>}
      {mode === 'reset' && <button type="button" className="link-btn center" onClick={() => { setMode('signin'); setMessage(null) }}>Назад ко входу</button>}
    </form>
  )
}

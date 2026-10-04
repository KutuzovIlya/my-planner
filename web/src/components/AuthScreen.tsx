import { skipAuth } from '../sync'
import { AuthForm } from './AuthForm'

/** Первый экран: войти, создать аккаунт или пока без него */
export function AuthScreen({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="auth-screen">
      <div className="auth-top">
        <img src="./icon-192.png" alt="" width={84} height={84} className="auth-logo" />
        <h1>Планер</h1>
        <p>Дела, задачи и планы на день. С аккаунтом всё хранится в облаке и доступно на любом устройстве.</p>
      </div>
      <AuthForm />
      <button
        className="link-btn center muted"
        onClick={() => {
          skipAuth(true)
          onSkip()
        }}
      >
        Пока без аккаунта
      </button>
    </div>
  )
}

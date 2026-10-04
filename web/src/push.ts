import { supabase } from './supabase'

// Пуш-уведомления: регистрация сервис-воркера и подписка устройства на сервере.

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker', e))
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Подписать это устройство и сохранить подписку в аккаунте. Возвращает текст ошибки или null. */
export async function subscribePush(): Promise<string | null> {
  if (!pushSupported()) return 'Этот браузер не поддерживает пуш-уведомления'
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) return 'Для уведомлений нужен аккаунт — войди в настройках'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }))
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: sub.endpoint,
        user_id: auth.session.user.id,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    if (error) return 'Не получилось сохранить подписку: ' + error.message
    return null
  } catch (e) {
    return 'Не получилось включить уведомления: ' + (e as Error).message
  }
}

/** Отписать это устройство (при выключении уведомлений и при выходе) */
export async function unsubscribePush() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch (e) {
    console.warn('unsubscribe', e)
  }
}

/** Пробное уведомление через сервер — проверяет всю цепочку */
export async function sendTestPush(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } })
  if (error) return 'Сервер не ответил: ' + error.message
  const { sent, devices } = data as { sent: number; devices: number }
  if (!devices) return 'Это устройство не подписано — выключи и снова включи уведомления'
  return sent ? 'Отправлено — уведомление придёт через пару секунд' : 'Не удалось доставить — попробуй выключить и включить уведомления'
}

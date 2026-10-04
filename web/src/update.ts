// Автообновление: GitHub Pages кэширует страницу до 10 минут, а приложение
// с экрана «Домой» может жить в памяти сутками. Проверяем version.json
// при запуске и при каждом возвращении в приложение.


async function check() {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const { id } = (await res.json()) as { id: string }
    if (!id || id === __BUILD_ID__) return
    // не зацикливаться, если сервер всё ещё отдаёт старую страницу
    const key = 'planner.update-tried'
    if (sessionStorage.getItem(key) === id) return
    sessionStorage.setItem(key, id)
    // новый адрес обходит кэш браузера
    location.replace(`${location.pathname}?v=${id}${location.hash}`)
  } catch {
    // нет сети — попробуем в следующий раз
  }
}

export function startUpdateChecks() {
  if (import.meta.env.DEV) return
  check()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

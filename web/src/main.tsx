import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { registerServiceWorker } from './push'
import { initSync } from './sync'
import { startUpdateChecks } from './update'

startUpdateChecks()
initSync()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

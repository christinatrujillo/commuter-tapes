import '@fontsource-variable/oswald'
import '@fontsource/special-elite'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'))
}

// Ask Chrome to keep progress even when the phone is low on storage (granted automatically for installed apps).
void navigator.storage?.persist?.()

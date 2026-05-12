import '@/lib/pwaRegister'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { PwaUpdateBar } from '@/components/PwaUpdateBar'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaUpdateBar />
  </StrictMode>,
)

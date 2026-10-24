import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import AppRoutes from './AppRoutes.tsx'
import { AuthProvider } from './auth.tsx'
import { registerServiceWorker } from './registerServiceWorker.ts'

// Entry point: the router, the signed-in state, and the pages, rendered into <div id="root"> in
// index.html. The service worker (for installing the app) is registered afterwards.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

registerServiceWorker()

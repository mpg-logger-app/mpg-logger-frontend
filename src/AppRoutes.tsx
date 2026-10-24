import { Navigate, Route, Routes } from 'react-router'
import AccountPage from './AccountPage.tsx'
import App from './App.tsx'
import AppLayout from './AppLayout.tsx'
import AuthPage from './AuthPage.tsx'
import { RedirectIfSignedIn, RequireAuth } from './auth.tsx'
import Landing from './Landing.tsx'

/**
 * /          landing page (signed-in visitors skip to /home)
 * /signin    sign in
 * /signup    sign up
 * /home      the fuel log (signed in only)
 * /account   change your name (signed in only)
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RedirectIfSignedIn>
            <Landing />
          </RedirectIfSignedIn>
        }
      />
      <Route
        path="/signin"
        element={
          <RedirectIfSignedIn>
            <AuthPage key="signin" mode="signin" />
          </RedirectIfSignedIn>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfSignedIn>
            <AuthPage key="signup" mode="signup" />
          </RedirectIfSignedIn>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<App />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

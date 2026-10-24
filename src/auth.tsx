import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import * as api from './api.ts'
import type { Account } from './account.ts'
import { AuthContext, useAuth } from './useAuth.ts'

/**
 * Knows who is signed in. The session itself is an HttpOnly cookie the browser keeps until
 * sign-out (even after the browser is closed); on load this asks the backend whose it is.
 *
 * @param props.children the app; read the state with useAuth()
 * @returns the children, with the auth state available to them
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccountState] = useState<Account | null | undefined>(undefined)
  // Tells RequireAuth whether to go to the landing page (you signed out) or to sign-in (session lost).
  const [signedOut, setSignedOut] = useState(false)
  // Why the saved session couldn't be checked (offline, backend down). Not the same as signed out.
  const [checkError, setCheckError] = useState<string | null>(null)
  // Bumped by Retry to check again.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    api.getAccount().then(
      (a) => {
        if (ignore) return
        setAccountState(a)
        setCheckError(null)
      },
      (e: Error) => {
        if (!ignore) setCheckError(e.message)
      },
    )
    return () => {
      ignore = true
    }
  }, [attempt])

  // Signed out in another tab, or the session expired: any API call now gets a 401.
  useEffect(() => {
    const onSessionEnded = () => setAccountState(null)
    window.addEventListener(api.SESSION_ENDED_EVENT, onSessionEnded)
    return () => window.removeEventListener(api.SESSION_ENDED_EVENT, onSessionEnded)
  }, [])

  /** Checks the saved session again (the Try again button on the Can't connect screen). */
  const retryCheck = useCallback(() => {
    setCheckError(null)
    setAttempt((n) => n + 1)
  }, [])

  /** Signs in and remembers the account; throws the server's message on failure. */
  const signIn = useCallback(async (username: string, password: string) => {
    setAccountState(await api.signIn(username, password))
    setSignedOut(false)
  }, [])

  /** Creates the account, signs in and remembers it; throws the server's message on failure. */
  const signUp = useCallback(async (username: string, name: string, password: string) => {
    setAccountState(await api.signUp(username, name, password))
    setSignedOut(false)
  }, [])

  /** Ends the session; RequireAuth then goes to the landing page. Throws if the server can't be reached. */
  const signOut = useCallback(async () => {
    await api.signOut()
    setAccountState(null)
    setSignedOut(true)
  }, [])

  /** Replaces the remembered account, e.g. after the name changes. */
  const setAccount = useCallback((a: Account) => setAccountState(a), [])

  const value = useMemo(
    () => ({ account, signedOut, checkError, retryCheck, signIn, signUp, signOut, setAccount }),
    [account, signedOut, checkError, retryCheck, signIn, signUp, signOut, setAccount],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

/**
 * Shown while the saved session is being checked, so pages don't flash the wrong thing.
 *
 * @returns a centered spinner, announced as "Loading"
 */
export function Checking() {
  return (
    <div className="checking" role="status" aria-label="Loading">
      <span className="spinner" aria-hidden="true" />
    </div>
  )
}

/**
 * The session couldn't be checked, usually because the phone is offline. The installed app still
 * opens from its cache, so this says so instead of wrongly asking you to sign in again.
 *
 * @returns the message with the error and a Try again button
 */
function CantConnect() {
  const { checkError, retryCheck } = useAuth()
  return (
    <main className="app cant-connect">
      <div className="card cant-connect-card" role="alert">
        <span className="cant-connect-icon" aria-hidden="true">
          📡
        </span>
        <h1>Can’t connect</h1>
        <p className="secondary">
          Your fuel log needs an internet connection. Check your connection and try again.
        </p>
        <p className="secondary cant-connect-detail">{checkError}</p>
        <button type="button" className="button filled large" onClick={retryCheck}>
          Try again
        </button>
      </div>
    </main>
  )
}

/**
 * Signed-in pages: anyone else is sent to sign in, then brought back here.
 * Right after you sign out, it goes to the landing page instead.
 *
 * @param props.children the signed-in page
 * @returns the page, a spinner, the Can't connect screen, or a redirect
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { account, signedOut, checkError } = useAuth()
  const location = useLocation()
  if (account === undefined) return checkError ? <CantConnect /> : <Checking />
  if (account === null) {
    if (signedOut) return <Navigate to="/" replace />
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  return children
}

/**
 * Landing and sign-in pages: someone already signed in goes straight to the app. This is also
 * what moves you on after signing in: back to the page that sent you to sign in, or /home.
 *
 * @param props.children the page for visitors
 * @returns the page, a spinner, or a redirect into the app
 */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { account, checkError } = useAuth()
  const location = useLocation()
  // Can't tell who you are (offline): show the page anyway; signing in will explain the problem.
  if (account === undefined) return checkError ? children : <Checking />
  if (account) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/home'} replace />
  }
  return children
}

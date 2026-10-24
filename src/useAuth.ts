import { createContext, useContext } from 'react'
import type { Account } from './account.ts'

// Kept apart from auth.tsx so that file only exports components (for Vite's fast refresh).

/** What useAuth() gives: who is signed in, and the actions that change it. */
export interface AuthValue {
  /** undefined while checking for a saved session, null when signed out. */
  account: Account | null | undefined
  /** True after signing out on this page (as opposed to the session ending some other way). */
  signedOut: boolean
  /** Why the saved session couldn't be checked (e.g. offline), or null. */
  checkError: string | null
  /** Checks the saved session again, after checkError. */
  retryCheck: () => void
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, name: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** After the account page saves new details. */
  setAccount: (account: Account) => void
}

/** Filled in by AuthProvider; null outside it. */
export const AuthContext = createContext<AuthValue | null>(null)

/**
 * Who is signed in, and the actions to sign in or out.
 *
 * @returns the auth state from the nearest AuthProvider
 * @throws Error if used outside <AuthProvider>
 */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

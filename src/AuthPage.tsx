import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { NAME_MAX, PASSWORD_MIN, USERNAME_MAX, nameProblem, passwordProblem, usernameProblem } from './account.ts'
import { useAuth } from './useAuth.ts'
import { Brand } from './Landing.tsx'

/** Which form the page shows: /signin or /signup. */
type Mode = 'signin' | 'signup'

/**
 * Sign in and sign up share one page with a switch at the top. Sign-up only asks for a
 * username, name and password. Once signed in, RedirectIfSignedIn moves on to /home.
 *
 * @param props.mode which form to show
 * @returns the page
 */
export default function AuthPage({ mode }: { mode: Mode }) {
  const { signIn, signUp } = useAuth()
  // Keep "where to go after signing in" when switching between the two modes.
  const { state } = useLocation()
  const isSignUp = mode === 'signup'

  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Checks the fields (all sign-up rules, or both fields filled for sign-in), then signs up or in.
   * On failure the reason is shown and the form can be sent again.
   *
   * @param event the form submit (button or Enter)
   */
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    if (isSignUp) {
      const problem = usernameProblem(username) ?? nameProblem(name) ?? passwordProblem(password)
      if (problem) {
        setError(problem)
        return
      }
    } else if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (isSignUp) {
        await signUp(username, name, password)
      } else {
        await signIn(username, password)
      }
      // Nothing else to do: the page is replaced as soon as the account is known.
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <header className="topbar">
        <Brand to="/" />
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
          <p className="secondary auth-subtitle">
            {isSignUp ? 'Start tracking your fuel economy.' : 'Sign in to see your fuel log.'}
          </p>

          <nav className="segmented" aria-label="Sign in or sign up">
            <Link
              to="/signin"
              state={state}
              replace
              className={isSignUp ? '' : 'active'}
              aria-current={isSignUp ? undefined : 'page'}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              state={state}
              replace
              className={isSignUp ? 'active' : ''}
              aria-current={isSignUp ? 'page' : undefined}
            >
              Sign up
            </Link>
          </nav>

          <form onSubmit={submit} noValidate>
            <div className="card">
              <label className="field">
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={USERNAME_MAX + 10}
                  autoFocus
                />
              </label>

              {isSignUp && (
                <label className="field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={NAME_MAX + 10}
                  />
                </label>
              )}

              <div className="field">
                <label htmlFor="auth-password">Password</label>
                <div className="password-input">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="show-password"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>

            {isSignUp && (
              <p className="field-hint secondary">
                Usernames are 3–{USERNAME_MAX} letters, numbers, dots or underscores, and are unique. Passwords
                need at least {PASSWORD_MIN} characters.
              </p>
            )}

            {error && (
              <div className="banner error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="button filled large block" disabled={submitting}>
              {submitting ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch secondary">
            {isSignUp ? 'Already have an account? ' : 'New to MPG Logger? '}
            <Link to={isSignUp ? '/signin' : '/signup'} state={state} replace>
              {isSignUp ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

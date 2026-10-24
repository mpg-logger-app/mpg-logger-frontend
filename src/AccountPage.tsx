import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { updateAccount } from './api.ts'
import { NAME_MAX, nameProblem } from './account.ts'
import { useAuth } from './useAuth.ts'
import Toast from './Toast.tsx'
import type { ToastVariant } from './Toast.tsx'

/**
 * /account: change your name. The username is fixed, and password changes are coming later.
 *
 * @returns the page (details beside password on desktop)
 */
export default function AccountPage() {
  const { account, setAccount } = useAuth()
  const [name, setName] = useState(account!.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [toast, setToast] = useState<{ key: number; message: string; variant: ToastVariant } | null>(null)
  /**
   * Shows the toast, replaying its animation even for the same message.
   *
   * @param message e.g. "Name saved"
   * @param variant success (default) or error
   */
  const showToast = (message: string, variant: ToastVariant = 'success') =>
    setToast((t) => ({ key: (t?.key ?? 0) + 1, message, variant }))
  /** Removes the toast once it has finished (called by Toast). */
  const hideToast = useCallback(() => setToast(null), [])

  const hasChanges = name.trim() !== account!.name
  const problem = nameProblem(name)
  const canSave = hasChanges && problem === null && !saving

  /**
   * Saves the trimmed name and updates it everywhere (top bar included).
   *
   * @param event the form submit (Save Changes or Enter)
   */
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAccount(name.trim())
      setAccount(updated)
      setName(updated.name)
      showToast('Name saved')
    } catch (e) {
      showToast("Couldn't save name", 'error')
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="app">
      <Link to="/home" className="back-link">
        ‹ Fuel log
      </Link>
      <h1>Account</h1>

      <div className="app-columns">
        <form onSubmit={save}>
          <section>
            <h2>Personal Details</h2>
            <div className="card">
              <div className="row">
                <span>Username</span>
                <span className="secondary">{account!.username}</span>
              </div>
              <label className="row">
                <span>Name</span>
                <input
                  className="row-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={NAME_MAX + 10}
                />
              </label>
              {hasChanges && problem && <div className="row edit-problem">{problem}</div>}
            </div>
            <p className="field-hint secondary">Your username can’t be changed.</p>
          </section>

          <section>
            <div className="card">
              <button type="submit" className="primary" disabled={!canSave}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            {error && (
              <div className="banner error" role="alert">
                {error}
              </div>
            )}
          </section>
        </form>

        <section>
          <h2>Password</h2>
          <div className="card">
            <div className="row coming-soon">
              <span className="coming-soon-icon" aria-hidden="true">
                🔑
              </span>
              <div>
                <div className="headline">Password changes are on the way</div>
                <div className="secondary">
                  You’ll be able to change your password here soon. Until then, your current password keeps working.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {toast && <Toast key={toast.key} message={toast.message} variant={toast.variant} onDone={hideToast} />}
    </main>
  )
}

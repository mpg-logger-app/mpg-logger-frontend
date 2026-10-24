import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth.ts'
import { Brand } from './Landing.tsx'

/** The bar across the top of the signed-in pages (/home and /account). */
export default function AppLayout() {
  const { account, signOut } = useAuth()
  const { pathname } = useLocation()

  // The menu under your name. It remembers the page it was opened on, so going to another
  // page (e.g. picking Profile) closes it without an effect.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const menuOpen = menuOpenOn === pathname
  const closeMenu = () => setMenuOpenOn(null)

  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // While open: a click anywhere else closes it, and the first item gets focus for the keyboard.
  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.parentElement?.contains(e.target as Node)) setMenuOpenOn(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  // Escape closes the menu; the arrow keys move between its items.
  function onMenuKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeMenu()
      buttonRef.current?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = [...menuRef.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = (items.indexOf(document.activeElement as HTMLElement) + step + items.length) % items.length
    items[next].focus()
  }

  async function handleSignOut() {
    setSigningOut(true)
    setError(null)
    try {
      // RequireAuth then takes you to the landing page.
      await signOut()
    } catch (e) {
      setError(`Couldn't sign out. ${(e as Error).message}`)
      setSigningOut(false)
      closeMenu()
    }
  }

  return (
    <>
      <header className="topbar app-topbar">
        <Brand to="/home" />
        <div className="account-menu">
          <button
            type="button"
            ref={buttonRef}
            className="account-button"
            aria-label={`Account menu for ${account!.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
          >
            <span className="avatar" aria-hidden="true">
              {account!.name.charAt(0).toUpperCase()}
            </span>
            <span className="account-name">{account!.name}</span>
            <svg className="chevron" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5l3 3 3-3" />
            </svg>
          </button>

          {menuOpen && (
            <div className="menu" role="menu" aria-label="Account" ref={menuRef} onKeyDown={onMenuKeyDown}>
              <Link to="/account" role="menuitem" className="menu-item" onClick={closeMenu}>
                Profile
              </Link>
              <button
                type="button"
                role="menuitem"
                className="menu-item danger"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </header>
      {error && (
        <div className="banner error topbar-error" role="alert">
          {error}
        </div>
      )}
      <Outlet />
    </>
  )
}

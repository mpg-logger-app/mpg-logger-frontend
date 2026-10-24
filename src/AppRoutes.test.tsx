// Tests for the pages and routing (landing, sign in/up, guards, account menu, account page) with the API mocked.
import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api.ts'
import AppRoutes from './AppRoutes.tsx'
import { AuthProvider } from './auth.tsx'
import { threeLogs } from './test/logs.ts'
import { TOAST_DURATION_MS } from './Toast.tsx'

vi.mock('./api.ts', () => ({
  SESSION_ENDED_EVENT: 'mpg:session-ended',
  getAccount: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateAccount: vi.fn(),
  listFuelLogs: vi.fn(),
  createFuelLog: vi.fn(),
  updateFuelLog: vi.fn(),
  deleteFuelLog: vi.fn(),
}))
const mocked = vi.mocked(api)

const chandan = { id: 1, username: 'chandan', name: 'Chandan' }

/** Shows the current path so tests can check where they ended up. */
function Path() {
  return <div data-testid="path">{useLocation().pathname}</div>
}
/** The current path, as shown by Path. */
const path = () => screen.getByTestId('path').textContent

/** Clicks your name in the top bar to open the Profile / Sign out menu. */
const openAccountMenu = async () =>
  userEvent.click(await screen.findByRole('button', { name: /^Account menu for/ }))

/** Renders the whole app (router, auth, pages) starting at this address. */
function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <AppRoutes />
        <Path />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.getAccount.mockResolvedValue(null)
  mocked.listFuelLogs.mockResolvedValue(threeLogs())
})

describe('landing page', () => {
  /** Visitors see what the app does, with Sign in and Sign up links at the top right. */
  it('explains the app, with sign in and sign up in the top bar', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Know what every mile costs you.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()

    const topBar = within(screen.getByRole('navigation', { name: 'Account' }))
    expect(topBar.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
    expect(topBar.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
  })

  /** Nothing else shows until it's known whether someone is signed in. */
  it('shows a spinner while checking for a saved session', async () => {
    let finish!: (a: null) => void
    mocked.getAccount.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderAt('/')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    await act(async () => finish(null))
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
  })

  /** Visitors can still read the landing page when the backend is down. */
  it('still shows the landing page when the backend is unreachable', async () => {
    mocked.getAccount.mockRejectedValue(new Error('down'))
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'Get started, it’s free' })).toBeInTheDocument()
  })

  /** Offline, /home says it can't connect (with the reason and Try again) instead of sending you to sign in. */
  it('offline, signed-in pages say they can’t connect instead of asking you to sign in', async () => {
    mocked.getAccount.mockRejectedValueOnce(new Error("Can't reach the backend.")).mockResolvedValue(chandan)
    renderAt('/home')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Can’t connect')
    expect(alert).toHaveTextContent("Can't reach the backend.")
    expect(path()).toBe('/home')

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  /** A returning user with a saved session skips the landing page. */
  it('sends someone with a saved session straight to /home', async () => {
    mocked.getAccount.mockResolvedValue(chandan)
    renderAt('/')
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(path()).toBe('/home')
  })

  /** A mistyped address ends up on the landing page. */
  it('sends unknown paths to the landing page', async () => {
    renderAt('/nope')
    await screen.findByRole('heading', { name: 'Know what every mile costs you.' })
    expect(path()).toBe('/')
  })

  /** StrictMode checks the session twice in development; only the second answer counts. */
  it('ignores the first, discarded session check under StrictMode', async () => {
    // StrictMode runs the check twice in development; only the second answer counts.
    mocked.getAccount.mockResolvedValueOnce(chandan).mockResolvedValue(null)
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <AppRoutes />
            <Path />
          </AuthProvider>
        </MemoryRouter>
      </StrictMode>,
    )
    expect(await screen.findByRole('heading', { name: 'Know what every mile costs you.' })).toBeInTheDocument()
    expect(path()).toBe('/')
  })

  /** A failure from the discarded first check must not show "Can't connect". */
  it('ignores a discarded failed session check under StrictMode', async () => {
    mocked.getAccount.mockRejectedValueOnce(new Error('stale')).mockResolvedValue(chandan)
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/home']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      </StrictMode>,
    )
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(screen.queryByText('Can’t connect')).toBeNull()
  })
})

describe('signing up', () => {
  /** Sign-up has exactly three fields and goes straight into the app. */
  it('asks only for username, name and password, then opens /home', async () => {
    mocked.signUp.mockResolvedValue(chandan)
    renderAt('/signup')

    await userEvent.type(await screen.findByLabelText('Username'), 'Chandan')
    await userEvent.type(screen.getByLabelText('Name'), 'Chandan')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    expect(screen.getAllByRole('textbox')).toHaveLength(2) // username + name; the password is hidden
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(mocked.signUp).toHaveBeenCalledWith('Chandan', 'Chandan', 'password123')
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(path()).toBe('/home')
    expect(screen.getByRole('button', { name: 'Account menu for Chandan' })).toBeInTheDocument()
  })

  /** Broken sign-up rules are explained before anything is sent. */
  it('checks the rules before sending', async () => {
    renderAt('/signup')
    await userEvent.type(await screen.findByLabelText('Username'), 'ab')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Username must be 3 to 30 characters.')

    await userEvent.type(screen.getByLabelText('Username'), 'c')
    await userEvent.type(screen.getByLabelText('Name'), 'Chandan')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters.')
    expect(mocked.signUp).not.toHaveBeenCalled()
  })

  /** A taken username shows the server's message and lets you try another. */
  it('shows when the username is taken', async () => {
    mocked.signUp.mockRejectedValue(new Error('That username is already taken.'))
    renderAt('/signup')
    await userEvent.type(await screen.findByLabelText('Username'), 'chandan')
    await userEvent.type(screen.getByLabelText('Name'), 'Someone')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken.')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    expect(path()).toBe('/signup')
  })

  /** Show and Hide switch the password field between visible and hidden. */
  it('can show the password while typing it', async () => {
    renderAt('/signup')
    const password = await screen.findByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})

describe('signing in', () => {
  /** Sign-in has no name field, and Enter signs in and opens the app. */
  it('signs in and opens /home', async () => {
    mocked.signIn.mockResolvedValue(chandan)
    renderAt('/signin')

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).toBeNull()
    await userEvent.type(screen.getByLabelText('Username'), 'chandan')
    await userEvent.type(screen.getByLabelText('Password'), 'password123{Enter}')

    expect(mocked.signIn).toHaveBeenCalledWith('chandan', 'password123')
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(path()).toBe('/home')
  })

  /** While signing in, the button says so and a second submit isn't sent. */
  it('ignores a second submit while signing in', async () => {
    let finish!: (a: typeof chandan) => void
    mocked.signIn.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderAt('/signin')
    await userEvent.type(await screen.findByLabelText('Username'), 'chandan')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('button', { name: 'Signing in…' }).closest('form')!)
    expect(mocked.signIn).toHaveBeenCalledOnce()

    await act(async () => finish(chandan))
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
  })

  /** Sign-in asks for both fields before sending. */
  it('needs both fields', async () => {
    renderAt('/signin')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your username and password.')
    expect(mocked.signIn).not.toHaveBeenCalled()
  })

  /** A wrong password shows the server's message. */
  it('shows a wrong password', async () => {
    mocked.signIn.mockRejectedValue(new Error('Wrong username or password.'))
    renderAt('/signin')
    await userEvent.type(await screen.findByLabelText('Username'), 'chandan')
    await userEvent.type(screen.getByLabelText('Password'), 'nope-nope{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
  })

  /** The switch at the top and the link at the bottom move between the two forms. */
  it('switches between sign in and sign up', async () => {
    renderAt('/signin')
    const switcher = within(await screen.findByRole('navigation', { name: 'Sign in or sign up' }))
    expect(switcher.getByRole('link', { name: 'Sign in' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(switcher.getByRole('link', { name: 'Sign up' }))
    expect(path()).toBe('/signup')
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

    await userEvent.click(within(screen.getByText(/Already have an account/)).getByRole('link', { name: 'Sign in' }))
    expect(path()).toBe('/signin')
  })

  /** Someone already signed in who opens /signin goes to /home. */
  it('a signed-in visitor skips the sign-in page', async () => {
    mocked.getAccount.mockResolvedValue(chandan)
    renderAt('/signin')
    await screen.findByText('Oct 15, 2026')
    expect(path()).toBe('/home')
  })
})

describe('signed-in pages', () => {
  /** Opening /account signed out goes to sign-in, then back to /account afterwards. */
  it('send signed-out visitors to sign in, then back where they were going', async () => {
    mocked.signIn.mockResolvedValue(chandan)
    renderAt('/account')

    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(path()).toBe('/signin')
    await userEvent.type(screen.getByLabelText('Username'), 'chandan')
    await userEvent.type(screen.getByLabelText('Password'), 'password123{Enter}')

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(path()).toBe('/account')
  })

  /** Sign out in the menu ends the session and shows the landing page. */
  it('sign out ends the session and goes back to the landing page', async () => {
    mocked.getAccount.mockResolvedValue(chandan)
    mocked.signOut.mockResolvedValue()
    renderAt('/home')

    await openAccountMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(mocked.signOut).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Know what every mile costs you.' })).toBeInTheDocument()
    expect(path()).toBe('/')
  })

  /** If signing out fails you stay signed in, see why, and can try again. */
  it('stays signed in if signing out fails', async () => {
    mocked.getAccount.mockResolvedValue(chandan)
    mocked.signOut.mockRejectedValue(new Error('Backend down'))
    renderAt('/home')

    await openAccountMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't sign out. Backend down")
    expect(path()).toBe('/home')
    expect(screen.queryByRole('menu')).toBeNull()

    await openAccountMenu()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeEnabled()
  })

  /** A session ended elsewhere (signed out in another tab, expired) sends you to sign in. */
  it('go back to sign in when the session ends elsewhere', async () => {
    mocked.getAccount.mockResolvedValue(chandan)
    renderAt('/home')
    await screen.findByText('Oct 15, 2026')

    act(() => {
      window.dispatchEvent(new Event(api.SESSION_ENDED_EVENT))
    })
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(path()).toBe('/signin')
  })
})

describe('account page', () => {
  beforeEach(() => {
    mocked.getAccount.mockResolvedValue(chandan)
  })

  /** Your name opens a menu with only Profile and Sign out; Profile opens /account. */
  it('opens from Profile in the menu under your name', async () => {
    renderAt('/home')
    const button = await screen.findByRole('button', { name: 'Account menu for Chandan' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()

    await openAccountMenu()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Account' })
    expect(menu).not.toHaveTextContent('@chandan') // just the two options, no name header
    // Profile first, Sign out under it.
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Profile', 'Sign out'])
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveFocus()

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Profile' }))
    expect(path()).toBe('/account')
    expect(screen.queryByRole('menu')).toBeNull()

    await userEvent.click(screen.getByRole('link', { name: '‹ Fuel log' }))
    expect(path()).toBe('/home')
  })

  /** Picking Profile closes the menu even when the page doesn't change. */
  it('Profile closes the menu even when already on /account', async () => {
    renderAt('/account')
    await openAccountMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Profile' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  /** The menu closes by clicking your name again, Escape, or a click outside it, but not a click inside. */
  it('the menu closes with the button, Escape, or a click elsewhere', async () => {
    renderAt('/home')

    await openAccountMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Chandan' }))
    expect(screen.queryByRole('menu')).toBeNull()

    await openAccountMenu()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Account menu for Chandan' })).toHaveFocus()

    await openAccountMenu()
    await userEvent.click(screen.getByRole('menu')) // inside: stays open
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('heading', { name: 'Fuel Log' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  /** Up and down arrows move between the menu items and wrap around. */
  it('the arrow keys move between menu items', async () => {
    renderAt('/home')
    await openAccountMenu()
    const profile = screen.getByRole('menuitem', { name: 'Profile' })
    const signOut = screen.getByRole('menuitem', { name: 'Sign out' })

    await userEvent.keyboard('{ArrowDown}')
    expect(signOut).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(profile).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(signOut).toHaveFocus()
    await userEvent.keyboard('a')
    expect(signOut).toHaveFocus()
  })

  /** A new (trimmed) name is saved and shows in the top bar right away; a blank name can't be saved. */
  it('updates the name everywhere', async () => {
    mocked.updateAccount.mockResolvedValue({ ...chandan, name: 'Chandan Jaladi' })
    renderAt('/account')

    const name = await screen.findByLabelText('Name')
    const save = screen.getByRole('button', { name: 'Save Changes' })
    expect(screen.getByText('chandan')).toBeInTheDocument()
    expect(save).toBeDisabled()

    await userEvent.clear(name)
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(save).toBeDisabled()

    await userEvent.type(name, '  Chandan Jaladi ')
    await userEvent.click(save)

    expect(mocked.updateAccount).toHaveBeenCalledWith('Chandan Jaladi')
    expect(await screen.findByRole('status')).toHaveTextContent('Name saved')
    expect(name).toHaveValue('Chandan Jaladi')
    expect(screen.getByRole('button', { name: 'Account menu for Chandan Jaladi' })).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  /** A failed save shows the reason and an error toast. */
  it('shows a save error', async () => {
    mocked.updateAccount.mockRejectedValue(new Error('Name must be 50 characters or fewer.'))
    renderAt('/account')
    await userEvent.type(await screen.findByLabelText('Name'), ' J')
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name must be 50 characters or fewer.')
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save name")
  })

  /** Submitting an unchanged form sends nothing. */
  it('submitting without changes saves nothing', async () => {
    renderAt('/account')
    // Browsers don't submit a form whose button is disabled, so submit it directly.
    fireEvent.submit((await screen.findByLabelText('Name')).closest('form')!)
    expect(mocked.updateAccount).not.toHaveBeenCalled()
  })

  /** The confirmation toast disappears on its own after a moment. */
  it('the "Name saved" toast goes away by itself', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    try {
      mocked.updateAccount.mockResolvedValue({ ...chandan, name: 'CJ' })
      renderAt('/account')
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const name = await screen.findByLabelText('Name')
      await user.clear(name)
      await user.type(name, 'CJ{Enter}')

      expect(await screen.findByRole('status')).toHaveTextContent('Name saved')
      act(() => vi.advanceTimersByTime(TOAST_DURATION_MS))
      expect(screen.queryByRole('status')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  /** The account page tells users password changes are coming. */
  it('says password changes are on the way', async () => {
    renderAt('/account')
    expect(await screen.findByText('Password changes are on the way')).toBeInTheDocument()
  })
})

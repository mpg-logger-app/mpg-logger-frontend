import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api.ts'
import AppRoutes from './AppRoutes.tsx'
import { AuthProvider } from './auth.tsx'
import { threeLogs } from './test/logs.ts'

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
const path = () => screen.getByTestId('path').textContent

const openAccountMenu = async () =>
  userEvent.click(await screen.findByRole('button', { name: /^Account menu for/ }))

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
  it('explains the app, with sign in and sign up in the top bar', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Know what every mile costs you.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()

    const topBar = within(screen.getByRole('navigation', { name: 'Account' }))
    expect(topBar.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
    expect(topBar.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
  })

  it('shows a spinner while checking for a saved session', async () => {
    let finish!: (a: null) => void
    mocked.getAccount.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderAt('/')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    await act(async () => finish(null))
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
  })

  it('still shows the landing page when the backend is unreachable', async () => {
    mocked.getAccount.mockRejectedValue(new Error('down'))
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'Get started, it’s free' })).toBeInTheDocument()
  })

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

  it('sends someone with a saved session straight to /home', async () => {
    mocked.getAccount.mockResolvedValue(chandan)
    renderAt('/')
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(path()).toBe('/home')
  })

  it('sends unknown paths to the landing page', async () => {
    renderAt('/nope')
    await screen.findByRole('heading', { name: 'Know what every mile costs you.' })
    expect(path()).toBe('/')
  })
})

describe('signing up', () => {
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

  it('needs both fields', async () => {
    renderAt('/signin')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your username and password.')
    expect(mocked.signIn).not.toHaveBeenCalled()
  })

  it('shows a wrong password', async () => {
    mocked.signIn.mockRejectedValue(new Error('Wrong username or password.'))
    renderAt('/signin')
    await userEvent.type(await screen.findByLabelText('Username'), 'chandan')
    await userEvent.type(screen.getByLabelText('Password'), 'nope-nope{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
  })

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

  it('a signed-in visitor skips the sign-in page', async () => {
    mocked.getAccount.mockResolvedValue(chandan)
    renderAt('/signin')
    await screen.findByText('Oct 15, 2026')
    expect(path()).toBe('/home')
  })
})

describe('signed-in pages', () => {
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

  it('Profile closes the menu even when already on /account', async () => {
    renderAt('/account')
    await openAccountMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Profile' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

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

  it('shows a save error', async () => {
    mocked.updateAccount.mockRejectedValue(new Error('Name must be 50 characters or fewer.'))
    renderAt('/account')
    await userEvent.type(await screen.findByLabelText('Name'), ' J')
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name must be 50 characters or fewer.')
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save name")
  })

  it('says password changes are on the way', async () => {
    renderAt('/account')
    expect(await screen.findByText('Password changes are on the way')).toBeInTheDocument()
  })
})

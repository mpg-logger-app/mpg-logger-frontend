// The signed-in user, and the sign-up rules (the same ones the backend's AccountRules checks).

/** The signed-in user, as GET /api/account returns it. */
export interface Account {
  id: number
  /** Always lowercase. */
  username: string
  /** Shown in the top bar. */
  name: string
}

/** Shortest allowed username. */
export const USERNAME_MIN = 3
/** Longest allowed username. */
export const USERNAME_MAX = 30
/** Longest allowed name. */
export const NAME_MAX = 50
/** Shortest allowed password. */
export const PASSWORD_MIN = 8
/** BCrypt on the server only reads 72 bytes, so longer passwords are refused. */
const PASSWORD_MAX_BYTES = 72

/**
 * Usernames are case-insensitive: "Chandan " and "chandan" are the same account.
 *
 * @param username what was typed
 * @returns it trimmed and lowercased, as the server stores it
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

/**
 * Checks a username before sign-up.
 *
 * @param username what was typed (any case, may have spaces around it)
 * @returns why it can't be used, or null if it can
 */
export function usernameProblem(username: string): string | null {
  const normalized = normalizeUsername(username)
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN} to ${USERNAME_MAX} characters.`
  }
  if (!/^[a-z0-9._]+$/.test(normalized)) {
    return 'Username can only use letters, numbers, dots and underscores.'
  }
  return null
}

/**
 * Checks a name before sign-up or saving it on the account page.
 *
 * @param name what was typed
 * @returns why it can't be used (blank or too long), or null if it can
 */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name is required.'
  if (trimmed.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer.`
  return null
}

/**
 * Checks a new password's length.
 *
 * @param password what was typed
 * @returns why it can't be used (under 8 characters or over 72 bytes), or null if it can
 */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'Password is too long.'
  return null
}

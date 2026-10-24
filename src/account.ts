// The signed-in user, and the sign-up rules (the same ones the backend's AccountRules checks).

export interface Account {
  id: number
  username: string
  name: string
}

export const USERNAME_MIN = 3
export const USERNAME_MAX = 30
export const NAME_MAX = 50
export const PASSWORD_MIN = 8
/** BCrypt on the server only reads 72 bytes, so longer passwords are refused. */
const PASSWORD_MAX_BYTES = 72

/** Usernames are case-insensitive: "Chandan " and "chandan" are the same account. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

/** Why this username can't be used, or null if it can. */
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

export function nameProblem(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name is required.'
  if (trimmed.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer.`
  return null
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'Password is too long.'
  return null
}

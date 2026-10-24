// Unit tests for account.ts: the sign-up rules, which must match the backend's AccountRules.
import { describe, expect, it } from 'vitest'
import { nameProblem, normalizeUsername, passwordProblem, usernameProblem } from './account.ts'

describe('sign-up rules (same as the backend)', () => {
  /** The form sends usernames the way the server stores them, so " Chandan " and "chandan" are one account. */
  it('trims and lowercases usernames', () => {
    expect(normalizeUsername('  Chandan ')).toBe('chandan')
  })

  /** 3 to 30 letters, numbers, dots and underscores pass; anything else gets the same message as the server. */
  it('checks username length and characters', () => {
    expect(usernameProblem('abc')).toBeNull()
    expect(usernameProblem(' Chandan.J_42 ')).toBeNull()
    expect(usernameProblem('ab')).toBe('Username must be 3 to 30 characters.')
    expect(usernameProblem('a'.repeat(31))).toBe('Username must be 3 to 30 characters.')
    expect(usernameProblem('has space')).toBe('Username can only use letters, numbers, dots and underscores.')
  })

  /** A blank name is refused, surrounding spaces don't count, and more than 50 characters is too long. */
  it('requires a name', () => {
    expect(nameProblem(' Chandan ')).toBeNull()
    expect(nameProblem('   ')).toBe('Name is required.')
    expect(nameProblem('x'.repeat(51))).toBe('Name must be 50 characters or fewer.')
  })

  /** At least 8 characters; the 72 limit is in UTF-8 bytes like BCrypt, so 37 "é" (74 bytes) is too long. */
  it('checks password length, in bytes at the top end', () => {
    expect(passwordProblem('12345678')).toBeNull()
    expect(passwordProblem('1234567')).toBe('Password must be at least 8 characters.')
    expect(passwordProblem('a'.repeat(72))).toBeNull()
    expect(passwordProblem('é'.repeat(37))).toBe('Password is too long.')
  })
})

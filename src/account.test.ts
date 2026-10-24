import { describe, expect, it } from 'vitest'
import { nameProblem, normalizeUsername, passwordProblem, usernameProblem } from './account.ts'

describe('sign-up rules (same as the backend)', () => {
  it('trims and lowercases usernames', () => {
    expect(normalizeUsername('  Chandan ')).toBe('chandan')
  })

  it('checks username length and characters', () => {
    expect(usernameProblem('abc')).toBeNull()
    expect(usernameProblem(' Chandan.J_42 ')).toBeNull()
    expect(usernameProblem('ab')).toBe('Username must be 3 to 30 characters.')
    expect(usernameProblem('a'.repeat(31))).toBe('Username must be 3 to 30 characters.')
    expect(usernameProblem('has space')).toBe('Username can only use letters, numbers, dots and underscores.')
  })

  it('requires a name', () => {
    expect(nameProblem(' Chandan ')).toBeNull()
    expect(nameProblem('   ')).toBe('Name is required.')
    expect(nameProblem('x'.repeat(51))).toBe('Name must be 50 characters or fewer.')
  })

  it('checks password length, in bytes at the top end', () => {
    expect(passwordProblem('12345678')).toBeNull()
    expect(passwordProblem('1234567')).toBe('Password must be at least 8 characters.')
    expect(passwordProblem('a'.repeat(72))).toBeNull()
    expect(passwordProblem('é'.repeat(37))).toBe('Password is too long.')
  })
})

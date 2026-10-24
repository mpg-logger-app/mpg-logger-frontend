import { screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

vi.mock('./api.ts', () => ({ listFuelLogs: vi.fn().mockResolvedValue([]) }))

it('mounts the app into #root', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  await import('./main.tsx')
  expect(await screen.findByRole('heading', { name: 'MPG Logger' })).toBeInTheDocument()
})

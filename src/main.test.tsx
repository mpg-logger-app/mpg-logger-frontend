import { screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

vi.mock('./api.ts', () => ({ getAccount: vi.fn().mockResolvedValue(null), SESSION_ENDED_EVENT: 'test' }))

it('mounts the app into #root and shows the landing page to visitors', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  await import('./main.tsx')
  expect(await screen.findByRole('heading', { name: 'Know what every mile costs you.' })).toBeInTheDocument()
})

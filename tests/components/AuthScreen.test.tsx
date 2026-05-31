import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  signInAsGuest: vi.fn(),
  signInWithApple: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
import * as auth from '../../src/lib/auth'
import { AuthScreen } from '../../src/components/AuthScreen'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('AuthScreen', () => {
  it('renders all three sign-in options', () => {
    render(<AuthScreen />)
    expect(screen.getByRole('button', { name: /Apple/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guest/i })).toBeInTheDocument()
  })

  it('guest sign-in calls signInAsGuest and navigates to the journey', async () => {
    ;(auth.signInAsGuest as any).mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: /Guest/i }))
    expect(auth.signInAsGuest).toHaveBeenCalledTimes(1)
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('shows an inline error when a provider sign-in fails', async () => {
    ;(auth.signInWithApple as any).mockResolvedValue({ data: {}, error: { message: 'Provider not enabled' } })
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: /Apple/i }))
    expect(await screen.findByText(/Provider not enabled/i)).toBeInTheDocument()
    // Did not navigate away.
    expect(useNavStore.getState().appView).toBe('auth')
  })
})

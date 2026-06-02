import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  signInAsGuest: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
}))
import * as auth from '../../src/lib/auth'
import { AuthScreen } from '../../src/components/AuthScreen'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('AuthScreen', () => {
  it('renders the email form plus social and guest sign-in options', () => {
    render(<AuthScreen />)
    expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guest/i })).toBeInTheDocument()
  })

  it('email sign-in calls signInWithEmail with the entered credentials and navigates', async () => {
    ;(auth.signInWithEmail as any).mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.type(screen.getByPlaceholderText(/Email/i), 'player@example.com')
    await user.type(screen.getByPlaceholderText(/Password/i), 'hunter2')
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }))
    expect(auth.signInWithEmail).toHaveBeenCalledWith('player@example.com', 'hunter2')
    expect(useNavStore.getState().appView).toBe('journey')
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
    ;(auth.signInWithGoogle as any).mockResolvedValue({ data: {}, error: { message: 'Provider not enabled' } })
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: /Google/i }))
    expect(await screen.findByText(/Provider not enabled/i)).toBeInTheDocument()
    // Did not navigate away.
    expect(useNavStore.getState().appView).toBe('auth')
  })
})

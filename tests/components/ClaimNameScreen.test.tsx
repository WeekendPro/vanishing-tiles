import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({
  getOwnProfile: vi.fn(),
  setDisplayName: vi.fn(),
}))
vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { ClaimNameScreen } from '../../src/components/ClaimNameScreen'
import { useProfileStore } from '../../src/store/profileStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useProfileStore.getState().clear()
  useNavStore.setState({ appView: 'claimName' })
  vi.clearAllMocks()
})

describe('ClaimNameScreen', () => {
  it('prefills a sanitized suggestion from the auth name and previews initials', () => {
    useProfileStore.setState({ loaded: true, authName: 'Luis Alejo', email: 'lou@example.com', isGuest: false })
    render(<ClaimNameScreen />)
    const input = screen.getByLabelText(/display name/i) as HTMLInputElement
    expect(input.value).toBe('LuisAlejo')
    // Single-word handle → first-two-letters avatar preview.
    expect(screen.getByText('LU')).toBeInTheDocument()
  })

  it('falls back to the email prefix when there is no auth name', () => {
    useProfileStore.setState({ loaded: true, authName: null, email: 'lou.m.alejo@gmail.com', isGuest: false })
    render(<ClaimNameScreen />)
    expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('loumalejo')
  })

  it('shows the specific rule violation live and disables submit', async () => {
    useProfileStore.setState({ loaded: true, authName: null, email: null, isGuest: false })
    const user = userEvent.setup()
    render(<ClaimNameScreen />)
    await user.type(screen.getByLabelText(/display name/i), 'A B C')
    expect(screen.getByText(/letters, numbers and underscores only/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /claim name/i })).toBeDisabled()
  })

  it('claims and goes Home on success', async () => {
    useProfileStore.setState({ loaded: true, authName: 'Luis Alejo', email: null, isGuest: false })
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: true, displayName: 'LuisAlejo' })
    const user = userEvent.setup()
    render(<ClaimNameScreen />)
    await user.click(screen.getByRole('button', { name: /claim name/i }))
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))
    expect(useProfileStore.getState().displayName).toBe('LuisAlejo')
  })

  it('renders "taken" inline and stays on the gate', async () => {
    useProfileStore.setState({ loaded: true, authName: 'Luis Alejo', email: null, isGuest: false })
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: false, reason: 'taken' })
    const user = userEvent.setup()
    render(<ClaimNameScreen />)
    await user.click(screen.getByRole('button', { name: /claim name/i }))
    expect(await screen.findByText(/that name is taken/i)).toBeInTheDocument()
    expect(useNavStore.getState().appView).toBe('claimName')
  })

  it('has no skip affordance — it is a gate', () => {
    useProfileStore.setState({ loaded: true, authName: null, email: null, isGuest: false })
    render(<ClaimNameScreen />)
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
  })
})

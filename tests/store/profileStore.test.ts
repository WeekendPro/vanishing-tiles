import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  getOwnProfile: vi.fn(),
  setDisplayName: vi.fn(),
}))
vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn(),
}))
import * as api from '../../src/lib/api'
import * as auth from '../../src/lib/auth'
import { useProfileStore, routeAfterAuth } from '../../src/store/profileStore'
import { useNavStore } from '../../src/store/navStore'

const luis = {
  data: {
    user: {
      email: 'lou@example.com',
      is_anonymous: false,
      user_metadata: { full_name: 'Luis Alejo', avatar_url: 'https://img/x.png' },
    },
  },
}

beforeEach(() => {
  useProfileStore.getState().clear()
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('profileStore.loadProfile', () => {
  it('merges the auth user (email/avatar/authName) with the profiles row (name/guest)', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap).toEqual({
      displayName: 'NeonRider', isGuest: false,
      email: 'lou@example.com', avatarUrl: 'https://img/x.png', authName: 'Luis Alejo',
    })
    expect(useProfileStore.getState().loaded).toBe(true)
    expect(useProfileStore.getState().displayName).toBe('NeonRider')
  })

  it('returns null (and stays empty) when there is no session', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({ data: { user: null } } as never)
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap).toBeNull()
    expect(api.getOwnProfile).not.toHaveBeenCalled()
  })

  it('treats a missing profiles row as unnamed non-guest (self-heal happens at claim time)', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue(null)
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap?.displayName).toBeNull()
    expect(snap?.isGuest).toBe(false)
  })

  it('trusts is_anonymous for guests even without a profiles row', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({
      data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
    } as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue(null)
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap?.isGuest).toBe(true)
  })
})

describe('profileStore.claimDisplayName', () => {
  it('rejects invalid input client-side without a network call', async () => {
    const res = await useProfileStore.getState().claimDisplayName('A B C')
    expect(res).toEqual({ ok: false, reason: 'invalid' })
    expect(api.setDisplayName).not.toHaveBeenCalled()
  })

  it('claims via the RPC (trimmed) and updates the store on ok', async () => {
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: true, displayName: 'NeonRider' })
    const res = await useProfileStore.getState().claimDisplayName('  NeonRider ')
    expect(api.setDisplayName).toHaveBeenCalledWith('NeonRider')
    expect(res.ok).toBe(true)
    expect(useProfileStore.getState().displayName).toBe('NeonRider')
  })

  it('passes "taken" through without touching the store', async () => {
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: false, reason: 'taken' })
    const res = await useProfileStore.getState().claimDisplayName('NeonRider')
    expect(res).toEqual({ ok: false, reason: 'taken' })
    expect(useProfileStore.getState().displayName).toBeNull()
  })
})

describe('routeAfterAuth', () => {
  it('routes an unnamed non-guest to the claim gate', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: false })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('claimName')
  })

  it('routes a named player home', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('home')
  })

  it('routes guests straight home — no gate', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({
      data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
    } as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: true })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('home')
  })

  it('routes to auth when there is no session', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({ data: { user: null } } as never)
    useNavStore.setState({ appView: 'home' })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('auth')
  })
})

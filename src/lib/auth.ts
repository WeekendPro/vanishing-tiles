import { supabase } from './supabase'

export const signInWithApple = () =>
  supabase.auth.signInWithOAuth({ provider: 'apple' })
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google' })
export const signInAsGuest = () => supabase.auth.signInAnonymously()
export const upgradeGuest = (provider: 'apple' | 'google') =>
  supabase.auth.linkIdentity({ provider })
export const signOut = () => supabase.auth.signOut()
export const getSession = () => supabase.auth.getSession()

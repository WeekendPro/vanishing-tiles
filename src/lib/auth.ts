import { supabase } from './supabase'

export const signInWithApple = () =>
  supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } })
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
export const signUpWithEmail = (email: string, password: string) =>
  supabase.auth.signUp({ email, password })
export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })
export const signInAsGuest = () => supabase.auth.signInAnonymously()
export const upgradeGuest = (provider: 'apple' | 'google') =>
  supabase.auth.linkIdentity({ provider })
export const signOut = () => supabase.auth.signOut()
export const getSession = () => supabase.auth.getSession()
export const getUser = () => supabase.auth.getUser()

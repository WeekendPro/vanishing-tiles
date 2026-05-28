export type BadFxMode = 'stamp' | 'fly'

export function getBadFxMode(): BadFxMode {
  if (typeof window === 'undefined') return 'stamp'
  return new URLSearchParams(window.location.search).get('badfx') === 'fly' ? 'fly' : 'stamp'
}

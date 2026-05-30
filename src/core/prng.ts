function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic PRNG in [0,1) seeded from an arbitrary string. */
export function makeRng(seed: string): () => number {
  return mulberry32(xmur3(seed)())
}

/** A fresh random seed string (uses Web Crypto, available in Deno + browsers). */
export function randomSeed(): string {
  const b = new Uint32Array(2)
  crypto.getRandomValues(b)
  return `${b[0].toString(36)}${b[1].toString(36)}`
}

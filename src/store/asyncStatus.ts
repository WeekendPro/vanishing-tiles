import { create } from 'zustand'

interface AsyncStatus {
  /** Number of in-flight tracked async calls. The global bar is visible when > 0. */
  pending: number
  start: () => void
  done: () => void
}

export const useAsyncStatus = create<AsyncStatus>((set) => ({
  pending: 0,
  start: () => set(s => ({ pending: s.pending + 1 })),
  done: () => set(s => ({ pending: Math.max(0, s.pending - 1) })),
}))

/**
 * Wrap any promise so the global loading bar reflects it. Increments on call,
 * decrements in a `finally` so rejections still stop the bar. Counter-based, so
 * overlapping calls keep the bar up until every one settles.
 */
export async function track<T>(p: Promise<T>): Promise<T> {
  useAsyncStatus.getState().start()
  try {
    return await p
  } finally {
    useAsyncStatus.getState().done()
  }
}

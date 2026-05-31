// Human-friendly "time ago" for an ISO timestamp, e.g. "2 hours ago",
// "18 mins ago", "last month". Returns '—' for missing/invalid input.
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'

  const sec = Math.round((now.getTime() - then) / 1000)
  if (sec < 0) return 'just now'        // clock skew → don't show "in the future"
  if (sec < 45) return 'just now'

  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`

  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`

  const day = Math.round(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7) return `${day} days ago`

  const week = Math.round(day / 7)
  if (day < 30) return week === 1 ? 'last week' : `${week} weeks ago`

  const month = Math.round(day / 30)
  if (month < 12) return month === 1 ? 'last month' : `${month} months ago`

  const year = Math.round(day / 365)
  return year === 1 ? 'last year' : `${year} years ago`
}

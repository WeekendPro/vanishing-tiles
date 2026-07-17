/** One audio channel's row: a toggle (styled like the menu's Actions) plus a
 *  volume slider that dims/disables while the channel is off. Shared by the
 *  global menu, the Sound Design lab, and the pause overlay. */
export function ChannelControl({ label, enabled, volume, onToggle, onVolume, onVolumeCommit }: {
  label: string
  enabled: boolean
  volume: number
  onToggle: () => void
  onVolume: (v: number) => void
  /** Fired when the user releases the slider — a chance to preview the level. */
  onVolumeCommit?: () => void
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <button
        onClick={onToggle}
        className="w-44 shrink-0 text-left font-pixel uppercase tracking-[0.08em] text-base text-gray-200 hover:text-neon-cyan"
      >
        {label}: {enabled ? 'On' : 'Off'}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        disabled={!enabled}
        aria-label={`${label} volume`}
        onChange={e => onVolume(Number(e.target.value) / 100)}
        onPointerUp={onVolumeCommit}
        className="flex-1 min-w-0 accent-cyan-400 disabled:opacity-30"
      />
    </div>
  )
}

/** One audio channel's control: the channel label + an on/off switch share the
 *  top row, and a full-width volume slider sits beneath it (dimmed/disabled
 *  while the channel is off). Shared by the global menu's Sound row and the
 *  Sound Design lab — it always fills the width it's given. */
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
    <div className="w-full py-1">
      <div className="flex items-center justify-between gap-4">
        <span className="font-pixel uppercase tracking-[0.08em] text-base text-gray-200">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${label} ${enabled ? 'on' : 'off'}`}
          onClick={onToggle}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
            enabled ? 'bg-neon-cyan/80' : 'bg-white/15'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        disabled={!enabled}
        aria-label={`${label} volume`}
        onChange={e => onVolume(Number(e.target.value) / 100)}
        onPointerUp={onVolumeCommit}
        className="w-full mt-3 accent-cyan-400 disabled:opacity-30"
      />
    </div>
  )
}

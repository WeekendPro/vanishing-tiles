/** One audio channel's control: the channel label sits flush-left with its
 *  on/off switch right beside it, and a full-width volume slider drops in
 *  beneath only while the channel is on (off hides the slider entirely rather
 *  than showing it disabled). Shared by the global menu's Sound row and the
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
      <div className="flex items-center gap-3">
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
      {enabled && (
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          aria-label={`${label} volume`}
          onChange={e => onVolume(Number(e.target.value) / 100)}
          onPointerUp={onVolumeCommit}
          // `vt-range` gives the slider a round white thumb matching the toggle's
          // knob; --vt-range-fill drives the cyan-filled portion of the track.
          style={{ ['--vt-range-fill' as string]: `${Math.round(volume * 100)}%` }}
          className="vt-range w-full mt-3"
        />
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { useNavStore } from '../store/navStore'
import { useSettingsStore } from '../store/settingsStore'
import { useSoundLabStore, type LabSoundId } from '../store/soundLabStore'
import {
  sfx, ONE_SHOT_IDS, SOUND_LABELS,
  type OneShotId, type SoundPatch, type SoundLayer, type ToneLayer, type NoiseLayer,
  type OscType,
} from '../lib/sfx'
import { ScanlineOverlay, ChannelControl } from './ui'

/**
 * SOUND DESIGN — the calibration lab (menu → "Sound Design").
 *
 * Every game sound is a PATCH of tone/noise layers; this screen exposes every
 * layer parameter as a knob, replays the sound on demand — once (▶) or on a
 * LOOP (⟳, hands-free auditioning while dragging knobs) — with gameplay
 * context (streak / reveal step) where that shapes the sound, and lets the
 * designer save labeled presets per sound. Knob commits apply LIVE to the
 * real game (via soundLabStore → sfx), so tune → play a run → tune again.
 * The Export card dumps the whole bank as JSON to paste into a design
 * conversation, where winning values get promoted into DEFAULT_PATCHES.
 *
 * Deliberately shipped visible (no admin gate): pre-launch there's no one to
 * confuse, and tuning on the production build IS the workflow right now.
 */

// ── Knob ─────────────────────────────────────────────────────────────────────
// One labeled slider. `log` spaces perceptual params (Hz, seconds) so the
// bottom of the range isn't squeezed into the first few pixels. High internal
// resolution — the lab is a desktop-width precision surface, and values
// should settle exactly where the hand leaves them.
const STEPS = 1000
function Knob({ label, value, min, max, log = false, int = false, onChange, onCommit }: {
  label: string
  value: number
  min: number
  max: number
  log?: boolean
  int?: boolean
  onChange: (v: number) => void
  onCommit?: () => void
}) {
  const toT = (v: number) =>
    log ? Math.log(Math.max(v, min) / min) / Math.log(max / min) : (v - min) / (max - min)
  const fromT = (t: number) => {
    const raw = log ? min * Math.pow(max / min, t) : min + t * (max - min)
    if (int) return Math.round(raw)
    // Trim float noise so exported JSON stays readable.
    return Number(raw.toPrecision(4))
  }
  const display = int ? String(value) : value >= 100 ? String(Math.round(value)) : String(Number(value.toPrecision(3)))
  return (
    <label className="block">
      <span className="flex justify-between font-grotesk text-[10px] tracking-[0.08em] uppercase text-vt-dim">
        <span>{label}</span>
        <span className="text-vt-cyan tabular-nums normal-case">{display}</span>
      </span>
      <input
        type="range"
        min={0}
        max={STEPS}
        value={Math.round(toT(value) * STEPS)}
        onChange={e => onChange(fromT(Number(e.target.value) / STEPS))}
        onPointerUp={onCommit}
        className="w-full accent-cyan-400"
      />
    </label>
  )
}

// ── Layer editor ─────────────────────────────────────────────────────────────

const OSC_TYPES: OscType[] = ['sine', 'triangle', 'square', 'sawtooth']

function ToneEditor({ layer, onChange }: { layer: ToneLayer; onChange: (l: ToneLayer) => void }) {
  const set = (patch: Partial<ToneLayer>) => onChange({ ...layer, ...patch })
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div className="col-span-2 flex gap-1.5">
        {OSC_TYPES.map(t => (
          <button
            key={t}
            onClick={() => set({ type: t })}
            className={`flex-1 py-1 rounded font-grotesk text-[10px] uppercase tracking-[0.06em] border transition
              ${(layer.type ?? 'sine') === t
                ? 'border-vt-cyan text-vt-cyan bg-vt-cyan/10'
                : 'border-white/10 text-vt-dim hover:text-vt-text'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <Knob label="Pitch (Hz)" value={layer.freq} min={40} max={4200} log onChange={v => set({ freq: v })} />
      <Knob label="Length (s)" value={layer.dur} min={0.02} max={2.5} log onChange={v => set({ dur: v })} />
      <Knob label="Loudness" value={layer.gain ?? 0.2} min={0} max={0.5} onChange={v => set({ gain: v })} />
      <Knob label="Attack (s)" value={layer.attack ?? 0.004} min={0.001} max={0.5} log onChange={v => set({ attack: v })} />
      <Knob label="Delay (s)" value={layer.at ?? 0} min={0} max={1.2} onChange={v => set({ at: v })} />
      <div>
        <button
          onClick={() => set({ endFreq: layer.endFreq ? undefined : Math.round(layer.freq / 2) })}
          className={`mb-1 font-grotesk text-[10px] uppercase tracking-[0.06em] ${layer.endFreq ? 'text-vt-cyan' : 'text-vt-dim'}`}
        >
          Pitch glide: {layer.endFreq ? 'on' : 'off'}
        </button>
        {layer.endFreq != null && (
          <Knob label="Glide to (Hz)" value={layer.endFreq} min={40} max={4200} log onChange={v => set({ endFreq: v })} />
        )}
      </div>
      <div className="col-span-2">
        <button
          onClick={() => set({ lowpass: layer.lowpass ? undefined : 2000 })}
          className={`mb-1 font-grotesk text-[10px] uppercase tracking-[0.06em] ${layer.lowpass ? 'text-vt-cyan' : 'text-vt-dim'}`}
        >
          Soften (lowpass): {layer.lowpass ? 'on' : 'off'}
        </button>
        {layer.lowpass != null && (
          <Knob label="Brightness cap (Hz)" value={layer.lowpass} min={100} max={8000} log onChange={v => set({ lowpass: v })} />
        )}
      </div>
    </div>
  )
}

function NoiseEditor({ layer, onChange }: { layer: NoiseLayer; onChange: (l: NoiseLayer) => void }) {
  const set = (patch: Partial<NoiseLayer>) => onChange({ ...layer, ...patch })
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Knob label="Sweep from (Hz)" value={layer.from} min={100} max={10000} log onChange={v => set({ from: v })} />
      <Knob label="Sweep to (Hz)" value={layer.to} min={100} max={10000} log onChange={v => set({ to: v })} />
      <Knob label="Length (s)" value={layer.dur} min={0.02} max={2.5} log onChange={v => set({ dur: v })} />
      <Knob label="Loudness" value={layer.gain ?? 0.15} min={0} max={0.5} onChange={v => set({ gain: v })} />
      <Knob label="Focus (Q)" value={layer.q ?? 1.8} min={0.3} max={12} onChange={v => set({ q: v })} />
      <Knob label="Delay (s)" value={layer.at ?? 0} min={0} max={1.2} onChange={v => set({ at: v })} />
    </div>
  )
}

// ── Preset row (shared by one-shots and the bed) ────────────────────────────

function PresetRow({ soundId }: { soundId: LabSoundId }) {
  const { presets, savePreset, applyPreset, deletePreset } = useSoundLabStore(useShallow(s => ({
    presets: s.presets, savePreset: s.savePreset, applyPreset: s.applyPreset, deletePreset: s.deletePreset,
  })))
  const [label, setLabel] = useState('')
  const mine = presets.filter(p => p.soundId === soundId)
  return (
    <div className="mt-3 border-t border-white/5 pt-2.5">
      <div className="flex gap-2">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="label this version…"
          aria-label={`${soundId} preset label`}
          className="flex-1 min-w-0 rounded bg-black/40 border border-white/10 px-2 py-1.5 text-xs text-vt-text placeholder:text-vt-dim outline-none focus:border-vt-cyan"
        />
        <button
          onClick={() => { savePreset(soundId, label); setLabel('') }}
          disabled={!label.trim()}
          aria-label={`Save ${soundId} preset`}
          className="px-3 py-1.5 rounded border border-vt-lime/40 text-vt-lime font-grotesk text-[10px] uppercase tracking-[0.08em] hover:bg-vt-lime/10 disabled:opacity-30"
        >
          Save
        </button>
      </div>
      {mine.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {mine.map(p => (
            <li key={p.id} className="flex items-center gap-2 text-xs text-vt-text">
              <button
                onClick={() => applyPreset(p.id)}
                className="flex-1 min-w-0 truncate text-left hover:text-vt-cyan"
                title="Load this preset into the knobs (and the game)"
              >
                ◂ {p.label}
              </button>
              <button onClick={() => deletePreset(p.id)} aria-label={`Delete preset ${p.label}`} className="text-vt-dim hover:text-vt-red">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── One-shot sound card ──────────────────────────────────────────────────────

// Sounds whose in-game pitch depends on context get a preview slider for it.
const PREVIEW_CTX: Partial<Record<OneShotId, { label: string; min: number; max: number; def: number; toCtx: (v: number) => { streak?: number; step?: number } }>> = {
  pickCorrect: { label: 'Preview streak', min: 1, max: 15, def: 1, toCtx: v => ({ streak: v }) },
  bloom: { label: 'Preview reveal #', min: 1, max: 12, def: 1, toCtx: v => ({ step: v - 1 }) },
}

function SoundCard({ id }: { id: OneShotId }) {
  const { override, setPatch, resetSound } = useSoundLabStore(useShallow(s => ({
    override: s.overrides[id], setPatch: s.setPatch, resetSound: s.resetSound,
  })))
  const patch: SoundPatch = override ?? sfx.getDefaultPatch(id)
  const [open, setOpen] = useState(false)
  const [looping, setLooping] = useState(false)
  const meta = PREVIEW_CTX[id]
  const [ctxVal, setCtxVal] = useState(meta?.def ?? 0)

  const play = () => { sfx.unlock(); sfx.previewOneShot(id, meta?.toCtx(ctxVal) ?? {}) }

  // Loop mode: hands stay on the knobs, the sound replays itself. Each cycle
  // reads the LATEST patch + preview context through refs, and paces itself
  // to the sound's current full length (longest layer incl. onset) + a beat
  // of air — so stretching a sound never makes the loop clip it.
  const patchRef = useRef(patch)
  patchRef.current = patch
  const ctxRef = useRef(ctxVal)
  ctxRef.current = ctxVal
  useEffect(() => {
    if (!looping) return
    let timer: number
    const cycle = () => {
      sfx.previewOneShot(id, meta?.toCtx(ctxRef.current) ?? {})
      const len = Math.max(0.25, ...patchRef.current.layers.map(l => (l.at ?? 0) + l.dur))
      timer = window.setTimeout(cycle, (len + 0.4) * 1000)
    }
    sfx.unlock()
    cycle()
    return () => window.clearTimeout(timer)
    // meta is a per-id constant lookup, safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looping, id])

  const setLayer = (i: number, layer: SoundLayer) =>
    setPatch(id, { layers: patch.layers.map((l, j) => (j === i ? layer : l)) })
  const removeLayer = (i: number) =>
    setPatch(id, { layers: patch.layers.filter((_, j) => j !== i) })
  const addLayer = (layer: SoundLayer) => setPatch(id, { layers: [...patch.layers, layer] })

  return (
    <section className="rounded-xl bg-vt-panel border border-white/5 p-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left">
          <span className="font-silk text-[11px] tracking-[0.12em] uppercase text-vt-text">{SOUND_LABELS[id]}</span>
          {override && <span className="ml-2 align-middle text-[9px] font-grotesk uppercase tracking-[0.1em] text-vt-amber">tweaked</span>}
        </button>
        <button
          onClick={play}
          aria-label={`Play ${SOUND_LABELS[id]}`}
          className="w-9 h-9 grid place-items-center rounded-md border border-vt-cyan/40 text-vt-cyan hover:bg-vt-cyan/10 hover:shadow-vt-cyan transition"
        >
          ▶
        </button>
        <button
          onClick={() => setLooping(l => !l)}
          aria-label={`Loop ${SOUND_LABELS[id]}`}
          aria-pressed={looping}
          className={`w-9 h-9 grid place-items-center rounded-md border transition
            ${looping
              ? 'border-vt-lime text-vt-lime bg-vt-lime/10 shadow-vt-lime'
              : 'border-white/10 text-vt-dim hover:text-vt-cyan hover:border-vt-cyan/40'}`}
        >
          ⟳
        </button>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${SOUND_LABELS[id]}`}
          className="w-9 h-9 grid place-items-center rounded-md border border-white/10 text-vt-dim hover:text-vt-text"
        >
          {open ? '▾' : '▸'}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {meta && (
            <Knob label={meta.label} value={ctxVal} min={meta.min} max={meta.max} int onChange={setCtxVal} />
          )}
          {patch.layers.map((layer, i) => (
            <div key={i} className="rounded-lg bg-black/30 border border-white/5 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-grotesk text-[10px] uppercase tracking-[0.1em] text-vt-magenta">
                  Layer {i + 1} — {layer.kind === 'tone' ? 'tone' : 'noise sweep'}
                </span>
                <button
                  onClick={() => removeLayer(i)}
                  aria-label={`Remove layer ${i + 1} from ${SOUND_LABELS[id]}`}
                  className="text-vt-dim hover:text-vt-red text-xs"
                >
                  ✕
                </button>
              </div>
              {layer.kind === 'tone'
                ? <ToneEditor layer={layer} onChange={l => setLayer(i, l)} />
                : <NoiseEditor layer={layer} onChange={l => setLayer(i, l)} />}
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => addLayer({ kind: 'tone', freq: 660, dur: 0.2, gain: 0.12 })}
              className="flex-1 py-1.5 rounded border border-white/10 text-vt-dim hover:text-vt-cyan hover:border-vt-cyan/40 font-grotesk text-[10px] uppercase tracking-[0.08em]"
            >
              + tone layer
            </button>
            <button
              onClick={() => addLayer({ kind: 'noise', from: 1000, to: 4000, dur: 0.2, gain: 0.1, q: 2 })}
              className="flex-1 py-1.5 rounded border border-white/10 text-vt-dim hover:text-vt-cyan hover:border-vt-cyan/40 font-grotesk text-[10px] uppercase tracking-[0.08em]"
            >
              + noise layer
            </button>
            {override && (
              <button
                onClick={() => resetSound(id)}
                className="flex-1 py-1.5 rounded border border-vt-amber/40 text-vt-amber hover:bg-vt-amber/10 font-grotesk text-[10px] uppercase tracking-[0.08em]"
              >
                Reset to default
              </button>
            )}
          </div>
          <PresetRow soundId={id} />
        </div>
      )}
    </section>
  )
}

// ── Export card ──────────────────────────────────────────────────────────────

function ExportCard() {
  const exportJson = useSoundLabStore(s => s.exportJson)
  const [shown, setShown] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const show = () => { setShown(exportJson()); setCopied(false) }
  const copy = async () => {
    const json = exportJson()
    setShown(json)
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
    } catch {
      setCopied(false) // clipboard blocked — the textarea below is selectable
    }
  }
  return (
    <section className="rounded-xl bg-vt-panel border border-white/5 p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-silk text-[11px] tracking-[0.12em] uppercase text-vt-text">Export</span>
        <button onClick={show} className="px-3 h-9 rounded-md border border-white/10 text-vt-dim hover:text-vt-text font-grotesk text-[10px] uppercase tracking-[0.08em]">
          Show JSON
        </button>
        <button onClick={copy} className="px-3 h-9 rounded-md border border-vt-lime/40 text-vt-lime hover:bg-vt-lime/10 font-grotesk text-[10px] uppercase tracking-[0.08em]">
          {copied ? 'Copied ✓' : 'Copy JSON'}
        </button>
      </div>
      <p className="mt-1.5 font-grotesk text-[10px] text-vt-dim">
        Tweaks + presets live in this browser only. Paste this JSON back into the design chat to lock choices into the shipped defaults.
      </p>
      {shown != null && (
        <textarea
          readOnly
          value={shown}
          aria-label="Sound lab export JSON"
          className="mt-2 w-full h-48 rounded bg-black/50 border border-white/10 p-2 text-[10px] leading-snug text-vt-text font-mono"
        />
      )}
    </section>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function SoundDesignScreen() {
  const goHome = useNavStore(s => s.goHome)
  const { soundEnabled, setSoundEnabled, sfxVolume, setSfxVolume } = useSettingsStore(useShallow(s => ({
    soundEnabled: s.settings.soundEnabled,
    setSoundEnabled: s.setSoundEnabled,
    sfxVolume: s.settings.sfxVolume,
    setSfxVolume: s.setSfxVolume,
  })))
  const resetAll = useSoundLabStore(s => s.resetAll)

  return (
    // Unlike the game screens, the lab is a WORKBENCH — it gets desktop
    // width (slider precision scales with pixel length), with generous side
    // margins on very large monitors. Still collapses cleanly on a phone.
    <div className="min-h-screen vt-vignette text-vt-text px-4 md:px-12 pt-12 pb-16">
      <ScanlineOverlay />
      <div className="mx-auto w-full max-w-5xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            onClick={goHome}
            className="font-grotesk text-sm text-vt-magenta hover:text-glow-vt-magenta transition-transform active:translate-y-px"
          >
            ← Home
          </button>
          <button
            onClick={resetAll}
            className="font-grotesk text-[10px] uppercase tracking-[0.08em] text-vt-dim hover:text-vt-amber"
          >
            Reset all sounds
          </button>
        </div>
        <h1 className="font-silk text-base uppercase tracking-[0.15em] text-vt-cyan text-glow-vt-cyan">Sound Design</h1>
        <p className="font-grotesk text-[11px] text-vt-dim -mt-1.5 mb-1">
          Tweak · ▶ replay (⟳ loops it) · save labeled versions. Changes apply to the real game immediately.
        </p>

        {/* The master channel — same control as the menu. */}
        <section className="rounded-xl bg-vt-panel border border-white/5 px-3 py-1">
          <ChannelControl
            label="Sound FX"
            enabled={soundEnabled}
            volume={sfxVolume}
            onToggle={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (next) { sfx.unlock(); sfx.uiTap() }
            }}
            onVolume={setSfxVolume}
            onVolumeCommit={() => { sfx.unlock(); sfx.uiTap() }}
          />
        </section>

        {ONE_SHOT_IDS.map(id => <SoundCard key={id} id={id} />)}
        <ExportCard />
      </div>
    </div>
  )
}

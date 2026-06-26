import { useState, useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { useStaggerStore } from '../store/staggerStore'
import { useStaggerSandboxPresetStore } from '../store/staggerSandboxPresetStore'
import { STAGGER, gapCountForBatch, selectDurationForBatch } from '../lib/staggerCurve'
import { revealCountsForMechanic, resolveGapCount, NO_OVERRIDES, type SandboxOverrides } from '../lib/staggerMechanic'
import { levelByKey } from '../lib/staggerLevels'

const DEFAULT_PRESET = 'Default'

/**
 * Live calibration workbench for the Infinite Stagger sandbox (dev/preview only —
 * the caller gates it behind `isSandboxRun && isSandboxEnv()`). A fixed right-edge
 * dock of sliders that patch the store's ephemeral `sandboxOverrides`:
 *
 *  - Timing + multiplier knobs take effect LIVE (the reveal driver reads them per
 *    beat; the multiplier is read at pick time).
 *  - Structural knobs (pairs, gap count) apply on the next batch; the "Re-roll
 *    board" button regenerates the current batch immediately for instant feedback.
 *
 * Overrides are session-only and reset on every `startRun`.
 */

type NumericKey = keyof SandboxOverrides

interface KnobDef {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  def: number
  fmt: (v: number) => string
}

function Knob({
  def, value, override, onChange, onReset,
}: {
  def: KnobDef
  value: number
  override: number | null
  onChange: (v: number) => void
  onReset: () => void
}) {
  const shown = Math.min(Math.max(value, def.min), def.max)
  const dirty = override != null
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-grotesk text-[10px] uppercase tracking-[0.12em] text-vt-text/80">{def.label}</span>
        <span className="flex items-center gap-1.5">
          <span className={`font-silk text-[11px] tabular-nums ${dirty ? 'text-vt-amber text-glow-vt-amber' : 'text-vt-cyan'}`}>
            {def.fmt(shown)}
          </span>
          <button
            onClick={onReset}
            disabled={!dirty}
            aria-label={`Reset ${def.label}`}
            className="font-grotesk text-[11px] leading-none text-vt-dim hover:text-vt-amber transition disabled:opacity-25 disabled:hover:text-vt-dim"
          >
            ↺
          </button>
        </span>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={shown}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer accent-amber-400"
      />
    </div>
  )
}

export function StaggerSandboxPanel() {
  const { batchIndex, sandboxLevel, sandboxOverrides, setSandboxOverride, setSandboxOverrides, rerollBatch } = useStaggerStore(
    useShallow(s => ({
      batchIndex: s.batchIndex,
      sandboxLevel: s.sandboxLevel,
      sandboxOverrides: s.sandboxOverrides,
      setSandboxOverride: s.setSandboxOverride,
      setSandboxOverrides: s.setSandboxOverrides,
      rerollBatch: s.rerollBatch,
    })),
  )
  const presetMap = useStaggerSandboxPresetStore(s => s.presets)
  const { savePreset, deletePreset } = useStaggerSandboxPresetStore(
    useShallow(s => ({ savePreset: s.savePreset, deletePreset: s.deletePreset })),
  )
  const [open, setOpen] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_PRESET)
  const [nameDraft, setNameDraft] = useState('')

  // Switching the locked level (e.g. relaunching the sandbox on another level)
  // resets the preset picker — presets are per-level, so a stale selection from
  // the previous level must not linger.
  useEffect(() => { setSelectedPreset(DEFAULT_PRESET); setNameDraft('') }, [sandboxLevel])

  // Only meaningful inside a sandbox run (the caller already gates on this).
  if (sandboxLevel == null) return null
  const level = levelByKey(sandboxLevel)
  // Presets are scoped to the LOCKED level only (TWINS presets never show in SOLOS).
  const presets = presetMap[sandboxLevel] ?? []

  // Load a preset (or Default) into the live overrides and re-roll so structural
  // values show immediately. Default = clear all overrides.
  const applyPreset = (name: string) => {
    setSelectedPreset(name)
    if (name === DEFAULT_PRESET) setSandboxOverrides(NO_OVERRIDES)
    else {
      const preset = presets.find(p => p.name === name)
      if (preset) setSandboxOverrides(preset.overrides)
    }
    rerollBatch()
  }

  const onSave = () => {
    const name = nameDraft.trim()
    if (!name) return
    savePreset(sandboxLevel, name, sandboxOverrides)
    setSelectedPreset(name)
    setNameDraft('')
  }

  const onDelete = () => {
    if (selectedPreset === DEFAULT_PRESET) return
    deletePreset(sandboxLevel, selectedPreset)
    setSelectedPreset(DEFAULT_PRESET)
  }

  // Defaults track the locked level's mechanic + the curve at the current batch;
  // pairs cap follows the EFFECTIVE gap count (override or curve).
  const effGapCount = resolveGapCount(batchIndex, sandboxOverrides)
  const defPairs = revealCountsForMechanic(level.mechanic.kind, effGapCount).pairs

  const structure: KnobDef[] = [
    { key: 'pairs', label: 'Pairs / board', min: 0, max: Math.max(1, Math.floor(effGapCount / 2)), step: 1, def: defPairs, fmt: v => `${v}` },
    { key: 'gapCount', label: 'Gap count', min: 2, max: STAGGER.MAX_GAPS, step: 1, def: gapCountForBatch(batchIndex), fmt: v => `${v}` },
    { key: 'minDistance', label: 'Min gap spacing', min: 0, max: 2, step: 1, def: 0, fmt: v => v === 0 ? 'touching' : `${v} cell${v > 1 ? 's' : ''}` },
  ]
  const timing: KnobDef[] = [
    { key: 'revealStepMs', label: 'Flash stagger', min: 200, max: 2200, step: 20, def: STAGGER.REVEAL_STEP_MS, fmt: v => `${v}ms` },
    { key: 'revealBloomMs', label: 'Visible duration', min: 400, max: 4000, step: 40, def: STAGGER.REVEAL_BLOOM_MS, fmt: v => `${v}ms` },
    { key: 'revealWaveMs', label: 'Decay wave', min: 0, max: 600, step: 10, def: STAGGER.REVEAL_WAVE_MS, fmt: v => `${v}ms` },
    { key: 'twinOffsetMs', label: 'Twin offset', min: 0, max: 400, step: 5, def: STAGGER.REVEAL_TWIN_OFFSET_MS, fmt: v => `${v}ms` },
  ]
  const scoring: KnobDef[] = [
    { key: 'multiplier', label: 'Multiplier', min: 1, max: 10, step: 1, def: level.multiplier, fmt: v => `×${v}` },
    { key: 'selectDuration', label: 'Select clock', min: 3000, max: 40000, step: 500, def: selectDurationForBatch(batchIndex), fmt: v => `${(v / 1000).toFixed(1)}s` },
  ]

  const renderKnob = (def: KnobDef) => {
    const override = sandboxOverrides[def.key]
    return (
      <Knob
        key={def.key}
        def={def}
        value={override ?? def.def}
        override={override}
        onChange={v => setSandboxOverride(def.key, v)}
        onReset={() => setSandboxOverride(def.key, null)}
      />
    )
  }

  const anyOverride = Object.values(sandboxOverrides).some(v => v != null)
  const resetAll = () => (Object.keys(sandboxOverrides) as NumericKey[]).forEach(k => setSandboxOverride(k, null))

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-l-md border border-r-0 border-vt-amber/40 bg-vt-amber/10 px-1.5 py-3
          font-grotesk text-[10px] uppercase tracking-[0.18em] text-vt-amber text-glow-vt-amber hover:bg-vt-amber/20 transition
          [writing-mode:vertical-rl]"
      >
        Tune ◂
      </button>
    )
  }

  return (
    <div className="fixed right-0 top-0 z-40 h-screen w-72 overflow-y-auto border-l border-vt-amber/25 bg-vt-panel/95 backdrop-blur-sm p-4
      shadow-[inset_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-grotesk text-[9px] uppercase tracking-[0.2em] text-vt-amber text-glow-vt-amber">Sandbox · Tune</div>
          <div className="font-silk text-base text-vt-cyan text-glow-vt-cyan leading-none mt-0.5">{level.name}</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Collapse panel"
          className="font-grotesk text-[11px] uppercase tracking-[0.12em] text-vt-dim hover:text-vt-amber transition"
        >
          ▸
        </button>
      </div>

      {/* Presets — per-level named snapshots of the overrides. "Default" = the
          built-in mechanic/curve values (all overrides cleared). Scoped to this
          level only. Selecting one loads + re-rolls; Save captures the current
          knobs under a free-text name (upsert). */}
      <div className="mb-3 pb-3 border-b border-white/5">
        <div className="font-grotesk text-[9px] uppercase tracking-[0.18em] text-vt-dim mb-1.5">Preset</div>
        <div className="flex gap-1.5">
          <select
            aria-label="Load preset"
            value={selectedPreset}
            onChange={e => applyPreset(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-vt-cyan/30 bg-vt-raised px-2 py-1.5 font-grotesk text-[11px] text-vt-cyan
              focus:border-vt-cyan outline-none cursor-pointer"
          >
            <option value={DEFAULT_PRESET}>{DEFAULT_PRESET}</option>
            {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button
            onClick={onDelete}
            disabled={selectedPreset === DEFAULT_PRESET}
            aria-label="Delete preset"
            className="rounded-md border border-vt-red/30 px-2.5 font-grotesk text-[12px] text-vt-red hover:bg-vt-red/10 transition
              disabled:opacity-25 disabled:hover:bg-transparent"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <input
            aria-label="Preset name"
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave() }}
            placeholder="Name this config…"
            className="flex-1 min-w-0 rounded-md border border-white/10 bg-vt-raised px-2 py-1.5 font-grotesk text-[11px] text-vt-text
              placeholder:text-vt-faint focus:border-vt-cyan outline-none"
          />
          <button
            onClick={onSave}
            disabled={!nameDraft.trim()}
            className="rounded-md border border-vt-cyan/40 bg-vt-raised px-3 font-grotesk text-[10px] uppercase tracking-[0.12em] text-vt-cyan
              hover:bg-vt-cyan/10 transition disabled:opacity-30 disabled:hover:bg-transparent"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mb-2">
        <div className="font-grotesk text-[9px] uppercase tracking-[0.18em] text-vt-dim mb-1.5 flex items-center gap-1.5">
          Structure
          <span className="text-vt-faint normal-case tracking-normal text-[9px]">· re-roll to apply</span>
        </div>
        {structure.map(renderKnob)}
        <button
          onClick={rerollBatch}
          className="w-full mt-1 mb-1 rounded-md border border-vt-cyan/40 bg-vt-raised py-2
            font-grotesk text-[10px] uppercase tracking-[0.14em] text-vt-cyan hover:bg-vt-cyan/10 hover:shadow-vt-cyan transition active:translate-y-px"
        >
          ⟳ Re-roll board
        </button>
      </div>

      <div className="mb-2 pt-2 border-t border-white/5">
        <div className="font-grotesk text-[9px] uppercase tracking-[0.18em] text-vt-dim mb-1.5">Reveal timing · live</div>
        {timing.map(renderKnob)}
      </div>

      <div className="mb-2 pt-2 border-t border-white/5">
        <div className="font-grotesk text-[9px] uppercase tracking-[0.18em] text-vt-dim mb-1.5">Scoring &amp; clock · live</div>
        {scoring.map(renderKnob)}
      </div>

      <button
        onClick={resetAll}
        disabled={!anyOverride}
        className="w-full mt-2 rounded-md border border-vt-amber/30 py-2
          font-grotesk text-[10px] uppercase tracking-[0.14em] text-vt-amber hover:bg-vt-amber/10 transition
          disabled:opacity-30 disabled:hover:bg-transparent"
      >
        ↺ Reset all to defaults
      </button>
    </div>
  )
}

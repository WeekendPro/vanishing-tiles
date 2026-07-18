// ── Demo overlays ─────────────────────────────────────────────────────────────
// The three guided-demo JSX blocks. They live at DIFFERENT positions in the
// tree — the intro + end beat sit over the board; the footer row rides below
// the tray — so they're separate named exports rendered in their original spots.

// Demo intro — the countdown's overlay grammar (board visible under a
// veil), plain type: the two-step how-to + the opt-out, tap anywhere to
// begin. This is the ONE text screen the demo shows; a cleared demo
// batch flows straight into the real run (no end screen). Tapping the
// checkbox stops there — it must not also fire the tap-anywhere
// continue.
export function DemoIntroOverlay({ onBeginReveal }: { onBeginReveal: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onBeginReveal()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBeginReveal() } }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl bg-black/70 backdrop-blur-[2px] cursor-pointer text-left"
    >
      <div className="font-grotesk text-[10px] uppercase tracking-[0.22em] text-vt-cyan text-glow-vt-cyan mb-5">How it works</div>
      <div className="flex flex-col gap-3.5 mb-5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-grotesk font-bold text-[13px] text-vt-cyan text-glow-vt-cyan tabular-nums">1</span>
          <span className="font-grotesk text-sm font-medium text-vt-text">Memorize the pieces.</span>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-grotesk font-bold text-[13px] text-vt-cyan text-glow-vt-cyan tabular-nums">2</span>
          <span className="font-grotesk text-sm font-medium text-vt-text">Tap to recall what you saw.</span>
        </div>
      </div>
      {/* Sits right under step 2; the opt-out is NOT here — it's paired
          with the skip link down in the bottom row (see below). */}
      <div className="vt-demo-continue font-grotesk text-[10px] uppercase tracking-[0.2em] text-vt-dim">Tap to continue</div>
    </div>
  )
}

// Demo end beat — the intro's bookend: a short "you're ready"
// acknowledgment before the real run. OPAQUE background (bg-vt-void,
// no veil) — the board tiles behind must not show through. No timer/
// lives explainer. The opt-out is pinned to the bottom, under the
// start affordance: the LAST chance to turn the demo off before the
// countdown. Tapping anywhere (except the checkbox) starts the run.
export function DemoEndOverlay({
  onLeave, hideDemo, setHideDemo,
}: { onLeave: () => void; hideDemo: boolean; setHideDemo: (value: boolean) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onLeave}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLeave() } }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl bg-vt-void cursor-pointer px-6 text-center"
    >
      <div className="font-grotesk text-[10px] uppercase tracking-[0.22em] text-vt-lime text-glow-vt-lime mb-2">Nice work</div>
      <div className="font-grotesk font-bold text-xl text-vt-lime text-glow-vt-lime mb-6">You're ready to play</div>
      <div className="vt-demo-continue font-grotesk text-[10px] uppercase tracking-[0.2em] text-vt-dim">Tap to start</div>
      <label
        onClick={e => e.stopPropagation()}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 cursor-pointer font-grotesk text-[11px] text-vt-dim whitespace-nowrap"
      >
        <input
          type="checkbox"
          checked={hideDemo}
          onChange={e => setHideDemo(e.target.checked)}
          className="accent-[#28F0FF]"
        />
        Don't show this again
      </label>
    </div>
  )
}

// Demo bottom row — the opt-out and the skip link, thematic siblings on
// one line (bottom third): "Don't show this again" centered, "skip demo"
// flush right (rides where the pause button lives in the real run). Shown
// the whole demo — intro, memorize, recall — up until the countdown;
// hidden once the end beat is up (that screen carries its own opt-out).
// The equal 1fr side tracks center the opt-out across the full row.
export function DemoFooterRow({
  onLeave, hideDemo, setHideDemo,
}: { onLeave: () => void; hideDemo: boolean; setHideDemo: (value: boolean) => void }) {
  return (
    <div className="mt-3 w-full max-w-sm grid grid-cols-[1fr_auto_1fr] items-center">
      <span aria-hidden />
      <label className="flex items-center gap-2 cursor-pointer font-grotesk text-[11px] text-vt-dim whitespace-nowrap">
        <input
          type="checkbox"
          checked={hideDemo}
          onChange={e => setHideDemo(e.target.checked)}
          className="accent-[#28F0FF]"
        />
        Don't show this again
      </label>
      <button
        onClick={onLeave}
        className="justify-self-end font-grotesk text-[10px] uppercase tracking-[0.18em] text-vt-faint hover:text-vt-dim transition-colors"
      >
        skip demo ›
      </button>
    </div>
  )
}

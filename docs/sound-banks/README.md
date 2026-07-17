# Sound banks

Snapshots of the full 12-sound palette (`DEFAULT_PATCHES` in
[`src/lib/sfx.ts`](../../src/lib/sfx.ts)), kept as swappable JSON so a bank can
be restored without git archaeology. Each file is the exact patch data for
every one-shot, in the same shape the Sound Design lab exports and imports.

| File | Status | What it is |
| --- | --- | --- |
| `2026-07-17-full-palette.json` | **ACTIVE** (shipped in `DEFAULT_PATCHES`) | Full re-synthesis of all 12 sounds — multi-layer, glide-heavy, with noise transients on the punchy ones (go / bloom / batchClear / pickWrong / timeout / gameOver). Untested by ear as of promotion; on trial. |
| `2026-07-17-lab-bank.json` | Previous shipped set | The designer's lab-tuned bank (go / timeout / gameOver / bonusLift hand-tuned; bloom's noise "shing" muted at gain 0). This is the fallback if the full palette doesn't land. |

## Restoring a bank

The banks are plain data — to make one active, paste its patches back into
`DEFAULT_PATCHES` in `src/lib/sfx.ts` (or hand the JSON to Claude and ask for
the swap). A few tests in `tests/lib/sfx.test.ts` pin specific default
frequencies/types (`count`, `timeout`, `urgentTick`, `bonusLift`) and whether
`bloom`'s noise layer is muted — those move with the bank, so update them to
match whichever bank is active.

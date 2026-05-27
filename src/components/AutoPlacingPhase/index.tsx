import { useMemo, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { expandCartSlots } from '../../engine/cartSlots'

export function AutoPlacingPhase() {
  const { selection } = useGameStore(useShallow(s => ({ selection: s.selection })))

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const cartRef = useRef<SelectionCartHandle>(null)

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid />
      <SelectionCart ref={cartRef} slots={slots} consumed={new Set()} />
    </div>
  )
}

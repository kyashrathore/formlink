"use client"

import type { LifecyclePlanProposal } from "@/app/lib/lifecycle/plan-types"
import { create } from "zustand"

type State = {
  open: boolean
  plan?: LifecyclePlanProposal
}

type Actions = {
  set: (plan: LifecyclePlanProposal, open?: boolean) => void
  clear: () => void
  setOpen: (open: boolean) => void
}

export const useAutomationsPlanStore = create<State & Actions>((set) => ({
  open: false,
  plan: undefined,
  set: (plan, open = true) => set({ plan, open }),
  clear: () => set({ plan: undefined, open: false }),
  setOpen: (open) => set({ open }),
}))

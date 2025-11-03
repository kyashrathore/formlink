"use client"

import SubmissionAutomationsCard from "@/app/dashboard/forms/[formId]/components/responses/SubmissionAutomationsCard"
import {
  ScopedDrawer,
  ScopedDrawerContent,
  ScopedDrawerFooter,
  ScopedDrawerHeader,
  ScopedDrawerOverlay,
  ScopedDrawerPortal,
  ScopedDrawerTitle,
} from "@formlink/ui"

interface LifecyclePlanDrawerProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  lifecycleConfig?: { allowedActions?: any[]; enabled?: boolean } | null
  plan?: any
  onDismiss?: () => void
}

export function LifecyclePlanDrawer(props: LifecyclePlanDrawerProps) {
  const { formId, open, onOpenChange, lifecycleConfig, plan, onDismiss } = props
  return (
    <ScopedDrawer open={open} modal={false} onOpenChange={onOpenChange}>
      <ScopedDrawerPortal>
        <ScopedDrawerOverlay />
        <ScopedDrawerContent
          className="p-0 sm:max-w-xl"
          aria-describedby="automation-plan-desc"
        >
          <ScopedDrawerHeader className="bg-background sticky top-0 z-10 border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div>
                  <ScopedDrawerTitle className="text-base font-semibold">
                    {lifecycleConfig?.allowedActions?.length ||
                    lifecycleConfig?.enabled
                      ? "Edit per‑submission automations"
                      : "Create per‑submission automations"}
                  </ScopedDrawerTitle>
                  <p className="text-muted-foreground text-xs">
                    Configure actions that run for every new submission. Connect
                    integrations and set the minimal parameters required.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close plan"
                className="hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded-md"
                onClick={() => onOpenChange(false)}
              >
                ×
              </button>
            </div>
          </ScopedDrawerHeader>
          <p id="automation-plan-desc" className="sr-only">
            Review and run automation actions for incoming form submissions.
          </p>
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-3">
              <SubmissionAutomationsCard
                formId={formId}
                plan={plan}
                onDismiss={onDismiss}
              />
            </div>
            <ScopedDrawerFooter className="border-t p-3" />
          </div>
        </ScopedDrawerContent>
      </ScopedDrawerPortal>
    </ScopedDrawer>
  )
}

export default LifecyclePlanDrawer

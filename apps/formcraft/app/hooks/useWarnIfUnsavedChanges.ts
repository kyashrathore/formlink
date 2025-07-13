import {
  selectIsDirty,
  useFormStore,
} from "@/app/dashboard/forms/[formId]/FormEditor/useFormStore"
import { useEffect } from "react"

export function useWarnIfUnsavedChanges() {
  const isDirty = useFormStore(selectIsDirty)

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault()

        event.returnValue =
          "You have unsaved changes. Are you sure you want to leave?"
        return event.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isDirty])
}

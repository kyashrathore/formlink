import { useEffect } from "react"
import { selectIsDirty, useFormStore } from "../stores/useFormStore"

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

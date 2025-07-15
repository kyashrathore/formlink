import { create } from "zustand"
import { EmbedType } from "../lib/embed/utils"

interface FormPageContextState {
  embedType: EmbedType
  setEmbedType: (type: EmbedType) => void
}

export const useFormPageContext = create<FormPageContextState>((set) => ({
  embedType: "popup",
  setEmbedType: (type) => set({ embedType: type }),
}))

"use client"

import React, { createContext, useContext } from "react"
import { WorkbenchTool } from "./WorkbenchRail"

export type SelectionContext = {
  type: "element"
  tagName: string
  componentName?: string
  text?: string
  rawPrompt: string
}

interface WorkbenchContextType {
  activeTool: WorkbenchTool
  setActiveTool: (tool: WorkbenchTool) => void
  selectionContext: SelectionContext | null
  setSelectionContext: (context: SelectionContext | null) => void
}

const WorkbenchContext = createContext<WorkbenchContextType | undefined>(
  undefined
)

export function useWorkbench() {
  const context = useContext(WorkbenchContext)
  if (!context) {
    throw new Error("useWorkbench must be used within a WorkbenchProvider")
  }
  return context
}

export const WorkbenchProvider: React.FC<{
  children: React.ReactNode
  activeTool: WorkbenchTool
  setActiveTool: (tool: WorkbenchTool) => void
  selectionContext: SelectionContext | null
  setSelectionContext: (context: SelectionContext | null) => void
}> = ({
  children,
  activeTool,
  setActiveTool,
  selectionContext,
  setSelectionContext,
}) => {
  return (
    <WorkbenchContext.Provider
      value={{
        activeTool,
        setActiveTool,
        selectionContext,
        setSelectionContext,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  )
}

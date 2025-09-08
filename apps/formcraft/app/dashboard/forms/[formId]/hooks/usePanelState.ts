"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface PanelState {
  leftPanelWidth: number
  isResizing: boolean

  panelState: "expanded" | "collapsed" | "hidden"

  activeMainTab: "form" | "preview" | "responses" | "share" | "settings"
  activeChatTab: "chat" | "design"

  previewMode: "chat" | "conversation"
  editMode: boolean

  isFloating: boolean
  floatingPosition: { x: number; y: number }

  setActiveMainTab: (
    tab: "form" | "preview" | "responses" | "share" | "settings"
  ) => void
  setActiveChatTab: (tab: "chat" | "design") => void
  setPanelWidth: (width: number) => void
  setIsResizing: (isResizing: boolean) => void
  setPanelState: (state: "expanded" | "collapsed" | "hidden") => void
  toggleFloating: () => void
  setFloatingPosition: (position: { x: number; y: number }) => void
  setPreviewMode: (mode: "chat" | "conversation") => void
  toggleEditMode: () => void
  setEditMode: (editMode: boolean) => void
  resetToDefaults: () => void
}

export const usePanelState = create<PanelState>()(
  persist(
    (set, get) => ({
      leftPanelWidth: 400,
      isResizing: false,
      panelState: "expanded",
      activeMainTab: "form",
      activeChatTab: "chat",
      previewMode: "chat",
      editMode: true,
      isFloating: false,
      floatingPosition: { x: 50, y: 50 },

      setActiveMainTab: (tab) => {
        // Do not auto-collapse or change edit/preview when switching main tabs
        set({ activeMainTab: tab })
      },

      setActiveChatTab: (tab) => {
        // Decouple left panel (chat/design) from right panel edit/preview state
        set({ activeChatTab: tab })
      },

      setPanelWidth: (width) => {
        const constrainedWidth = Math.max(300, Math.min(600, width))
        set({ leftPanelWidth: constrainedWidth })
      },

      setIsResizing: (isResizing) => set({ isResizing }),

      setPanelState: (state) => set({ panelState: state }),

      toggleFloating: () => {
        const { isFloating, activeMainTab } = get()

        if (!isFloating) {
          if (activeMainTab === "form" || activeMainTab === "preview") {
            set({
              isFloating: true,
              panelState: "hidden",
            })
          } else {
            set({
              activeMainTab: "form",
              isFloating: true,
              panelState: "hidden",
            })
          }
        } else {
          let newPanelState: "expanded" | "collapsed" | "hidden" = "expanded"

          if (activeMainTab === "form" || activeMainTab === "preview") {
            newPanelState = "expanded"
          } else {
            newPanelState = "collapsed"
          }

          set({
            isFloating: false,
            panelState: newPanelState,
          })
        }
      },

      setFloatingPosition: (position) => set({ floatingPosition: position }),

      setPreviewMode: (mode) => set({ previewMode: mode }),

      toggleEditMode: () => set({ editMode: !get().editMode }),

      setEditMode: (editMode) => set({ editMode }),

      resetToDefaults: () =>
        set({
          activeMainTab: "form",
          activeChatTab: "chat",
          editMode: true,
          previewMode: "chat",
          // Keep layout preferences, only reset tab states
        }),
    }),
    {
      name: "panel-state",
      partialize: (state) => ({
        leftPanelWidth: state.leftPanelWidth,
        panelState: state.panelState,
        isFloating: state.isFloating,
        floatingPosition: state.floatingPosition,
      }),
    }
  )
)

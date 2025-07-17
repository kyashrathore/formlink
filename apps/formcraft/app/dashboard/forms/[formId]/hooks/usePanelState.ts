"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface PanelState {
  // Panel dimensions
  leftPanelWidth: number
  isResizing: boolean

  // Panel visibility
  panelState: "expanded" | "collapsed" | "hidden"

  // Active tabs
  activeMainTab: "form" | "responses" | "share" | "settings"
  activeChatTab: "chat" | "design"

  // Form preview modes
  previewMode: "chat" | "conversation"
  editMode: boolean

  // Floating mode
  isFloating: boolean
  floatingPosition: { x: number; y: number }

  // Actions
  setActiveMainTab: (tab: "form" | "responses" | "share" | "settings") => void
  setActiveChatTab: (tab: "chat" | "design") => void
  setPanelWidth: (width: number) => void
  setIsResizing: (isResizing: boolean) => void
  setPanelState: (state: "expanded" | "collapsed" | "hidden") => void
  toggleFloating: () => void
  setFloatingPosition: (position: { x: number; y: number }) => void
  setPreviewMode: (mode: "chat" | "conversation") => void
  toggleEditMode: () => void
}

export const usePanelState = create<PanelState>()(
  persist(
    (set, get) => ({
      // Initial state
      leftPanelWidth: 400,
      isResizing: false,
      panelState: "expanded",
      activeMainTab: "form",
      activeChatTab: "chat",
      previewMode: "chat",
      editMode: false,
      isFloating: false,
      floatingPosition: { x: 50, y: 50 },

      // Actions
      setActiveMainTab: (tab) => {
        const { isFloating } = get()
        set({ activeMainTab: tab })

        // Update panel state based on active tab and floating status
        if (isFloating) {
          // When floating panel is active
          switch (tab) {
            case "form":
              // Keep floating panel visible, sidebar hidden
              set({ panelState: "hidden" })
              break
            case "responses":
            case "share":
            case "settings":
              // Hide floating panel, show collapsed sidebar
              set({
                isFloating: false,
                panelState: "collapsed",
              })
              break
          }
        } else {
          // When sidebar panel is active
          switch (tab) {
            case "form":
              set({ panelState: "expanded" })
              break
            case "responses":
            case "share":
            case "settings":
              // Both responses, share, and settings collapse (unified behavior)
              set({ panelState: "collapsed" })
              break
          }
        }
      },

      setActiveChatTab: (tab) => set({ activeChatTab: tab }),

      setPanelWidth: (width) => {
        const constrainedWidth = Math.max(300, Math.min(600, width))
        set({ leftPanelWidth: constrainedWidth })
      },

      setIsResizing: (isResizing) => set({ isResizing }),

      setPanelState: (state) => set({ panelState: state }),

      toggleFloating: () => {
        const { isFloating, activeMainTab } = get()

        if (!isFloating) {
          // Going to floating mode - only if on Form tab
          if (activeMainTab === "form") {
            set({
              isFloating: true,
              panelState: "hidden",
            })
          }
          // If on Responses/Share tabs, switch to Form first then float
          else {
            set({
              activeMainTab: "form",
              isFloating: true,
              panelState: "hidden",
            })
          }
        } else {
          // Going back to docked mode - restore appropriate panel state
          let newPanelState: "expanded" | "collapsed" | "hidden" = "expanded"

          switch (activeMainTab) {
            case "form":
              newPanelState = "expanded"
              break
            case "responses":
            case "share":
            case "settings":
              // Unified behavior: all collapse
              newPanelState = "collapsed"
              break
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
    }),
    {
      name: "panel-state",
      partialize: (state) => ({
        leftPanelWidth: state.leftPanelWidth,
        panelState: state.panelState,
        activeMainTab: state.activeMainTab,
        activeChatTab: state.activeChatTab,
        previewMode: state.previewMode,
        editMode: state.editMode,
        isFloating: state.isFloating,
        floatingPosition: state.floatingPosition,
      }),
    }
  )
)

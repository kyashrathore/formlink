"use client"

import { useCallback } from "react"

interface ResizeHandleProps {
  onResizeStart: () => void
  onResize: (width: number) => void
  onResizeEnd: () => void
  isResizing: boolean
  currentWidth: number
}

export default function ResizeHandle({
  onResizeStart,
  onResize,
  onResizeEnd,
  isResizing,
  currentWidth,
}: ResizeHandleProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onResizeStart()

      const startX = e.clientX
      const startWidth = currentWidth

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX
        const newWidth = Math.max(300, Math.min(600, startWidth + deltaX))
        onResize(newWidth)
      }

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        onResizeEnd()
      }

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [onResizeStart, onResize, onResizeEnd, currentWidth]
  )

  return (
    <div
      className={`relative w-1 cursor-col-resize bg-gray-300 transition-all duration-200 ease-in-out hover:bg-blue-500 ${isResizing ? "w-2 bg-blue-500 shadow-lg" : ""} `}
      onMouseDown={handleMouseDown}
    >
      {/* Visual feedback dots */}
      <div
        className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 transform flex-col space-y-1 transition-all duration-200 ${isResizing ? "scale-125" : ""} `}
      >
        <div
          className={`h-0.5 w-0.5 rounded-full transition-all duration-200 ${isResizing ? "bg-white opacity-100" : "bg-gray-500 opacity-60"} `}
        ></div>
        <div
          className={`h-0.5 w-0.5 rounded-full transition-all duration-200 ${isResizing ? "bg-white opacity-100" : "bg-gray-500 opacity-60"} `}
        ></div>
        <div
          className={`h-0.5 w-0.5 rounded-full transition-all duration-200 ${isResizing ? "bg-white opacity-100" : "bg-gray-500 opacity-60"} `}
        ></div>
      </div>
    </div>
  )
}

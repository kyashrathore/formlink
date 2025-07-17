"use client"

import { useEffect, useRef, useState } from "react"
import { usePanelState } from "../hooks/usePanelState"

interface FloatingPanelProps {
  children: (props: {
    onHeaderMouseDown: (e: React.MouseEvent) => void
  }) => React.ReactNode
}

export default function FloatingPanel({ children }: FloatingPanelProps) {
  const { isFloating, floatingPosition, setFloatingPosition } = usePanelState()

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return

    e.preventDefault()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })

    // Prevent text selection while dragging
    document.body.style.userSelect = "none"
    document.body.style.pointerEvents = "none"
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return

      const newPosition = {
        x: Math.max(
          0,
          Math.min(window.innerWidth - 400, e.clientX - dragOffset.x)
        ),
        y: Math.max(
          0,
          Math.min(window.innerHeight - 600, e.clientY - dragOffset.y)
        ),
      }

      setFloatingPosition(newPosition)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      // Restore normal pointer events and text selection
      document.body.style.userSelect = ""
      document.body.style.pointerEvents = ""
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset, setFloatingPosition])

  // Handle window resize to keep panel in bounds
  useEffect(() => {
    const handleResize = () => {
      if (!isFloating || !panelRef.current) return

      const newPosition = {
        x: Math.max(0, Math.min(window.innerWidth - 400, floatingPosition.x)),
        y: Math.max(0, Math.min(window.innerHeight - 600, floatingPosition.y)),
      }

      setFloatingPosition(newPosition)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isFloating, floatingPosition, setFloatingPosition])

  if (!isFloating) return null

  return (
    <div
      ref={panelRef}
      className={`bg-card border-border fixed z-50 h-[600px] w-96 overflow-hidden rounded-lg border shadow-2xl ${isDragging ? "cursor-grabbing" : "cursor-auto"} ${isDragging ? "" : "transition-all duration-200 ease-out"} `}
      style={{
        left: `${floatingPosition.x}px`,
        top: `${floatingPosition.y}px`,
        transform: isDragging ? "scale(1.01)" : "scale(1)",
        boxShadow: isDragging
          ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      }}
    >
      {/* Content - No browser window header, let children handle their own header */}
      <div className="flex h-full flex-col">
        {children({ onHeaderMouseDown: handleMouseDown })}
      </div>

      {/* Resize handle */}
      <div className="absolute right-0 bottom-0 h-4 w-4 cursor-nw-resize">
        <div className="bg-muted-foreground absolute right-1 bottom-1 h-2 w-2 rounded-full"></div>
      </div>
    </div>
  )
}

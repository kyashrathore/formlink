"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@formlink/ui"
import { ChatCircle, ListDashes, PencilSimple } from "@phosphor-icons/react"
import { motion } from "motion/react"

interface FormCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMode: (mode: "chat" | "classic" | "typeform") => void
}

export function FormCreationModal({
  isOpen,
  onClose,
  onSelectMode,
}: FormCreationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create a new form</DialogTitle>
          <DialogDescription>
            Choose how you want to start building your form.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-3">
          <ModeCard
            title="Chat Form"
            description="Describe your form to AI and let it build it for you."
            icon={<ChatCircle className="h-8 w-8 text-purple-500" />}
            onClick={() => onSelectMode("chat")}
            delay={0}
          />
          <ModeCard
            title="Classic Builder"
            description="Start with a standard form editor and build manually."
            icon={<PencilSimple className="h-8 w-8 text-blue-500" />}
            onClick={() => onSelectMode("classic")}
            delay={0.1}
          />
          <ModeCard
            title="Typeform-like"
            description="Create a conversational one-question-per-page form."
            icon={<ListDashes className="h-8 w-8 text-orange-500" />}
            onClick={() => onSelectMode("typeform")}
            delay={0.2}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModeCard({
  title,
  description,
  icon,
  onClick,
  delay,
}: {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  delay: number
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card hover:border-primary focus-visible:ring-ring flex flex-col items-start gap-4 rounded-xl border p-4 text-left shadow-sm transition-all hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
      onClick={onClick}
    >
      <div className="bg-muted/50 rounded-lg p-3">{icon}</div>
      <div className="space-y-1">
        <h3 className="leading-none font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </motion.button>
  )
}

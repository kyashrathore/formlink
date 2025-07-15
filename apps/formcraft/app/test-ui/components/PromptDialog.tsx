"use client"

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@formlink/ui"
import React, { useEffect, useState } from "react"
import Chat from "./chat/chat-components/chat"

interface PromptDialogProps {
  trigger?: React.ReactNode // Made trigger optional
  title: string
  description: string
  onSubmit: (input: string) => void
  isOpen: React.ComponentProps<typeof Dialog>["open"]
  onOpenChange: React.ComponentProps<typeof Dialog>["onOpenChange"]
  loading?: boolean
  error?: string | null
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  trigger,
  onSubmit,
  isOpen,
  onOpenChange,
  loading = false,
  error = null,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[800px] max-w-[800px!important] gap-0 rounded-t-lg p-0">
        <div className="relative flex items-center">
          <Chat onSubmit={onSubmit} />
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700">
            Error: {error}
          </div>
        )}
        <DialogFooter className="items-center py-2 pl-4 sm:justify-start">
          <DialogClose asChild>
            <Button disabled={loading} type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PromptDialog

"use client"

import { Button, Input, Label, toast } from "@formlink/ui"
import { Pencil } from "lucide-react"
import React, { useEffect, useState } from "react"

interface EditableUrlInputProps {
  label: string
  enabledText: string
  initialValue?: string
  initialEnabled?: boolean
  inputType?: "url" | "email"
  onSave: (value: string) => void
  hideActionButtons?: boolean
}

const EditableUrlInput: React.FC<EditableUrlInputProps> = ({
  label,
  enabledText,
  initialValue = "",
  initialEnabled = false,
  inputType = "url",
  onSave,
  hideActionButtons = false,
}) => {
  const [enabled, setEnabled] = useState(!!initialValue || initialEnabled)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEnabled(!!initialValue || initialEnabled)
    setValue(initialValue)
    setEditing(false)
    setError(null)
  }, [initialValue, initialEnabled])

  const isValidUrl = (val: string) => {
    try {
      const u = new URL(val)
      return u.protocol === "http:" || u.protocol === "https:"
    } catch {
      return false
    }
  }

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validateInput = (val: string) => {
    if (inputType === "email") {
      return isValidEmail(val)
    }
    return isValidUrl(val)
  }

  const handleToggle = (checked: boolean) => {
    setEnabled(checked)
    if (!checked) {
      onSave("")
      setValue("")
      setEditing(false)
      setError(null)
    } else if (checked && !value) {
      setEditing(true)
    }
  }

  const handleEditDone = () => {
    if (!validateInput(value)) {
      setError(
        inputType === "email"
          ? "Please enter a valid email address."
          : "Please enter a valid URL (http or https)."
      )
      return
    }
    onSave(value)
    setEditing(false)
    setError(null)
  }

  const handleEdit = () => {
    setEditing(true)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <input
          id={`enable-${label.replace(/\s+/g, "-").toLowerCase()}`}
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <Label htmlFor={`enable-${label.replace(/\s+/g, "-").toLowerCase()}`}>
          {enabledText}
        </Label>
      </div>
      {enabled && (
        <div className="space-y-2">
          <Label htmlFor={`input-${label.replace(/\s+/g, "-").toLowerCase()}`}>
            {label}
          </Label>
          {editing ? (
            <div className="flex flex-col gap-2">
              <Input
                id={`input-${label.replace(/\s+/g, "-").toLowerCase()}`}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={
                  inputType === "email"
                    ? "name@example.com"
                    : "https://example.com/endpoint"
                }
                type={inputType}
                autoFocus
              />
              {error && <div className="text-sm text-red-500">{error}</div>}
              {!hideActionButtons && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleEditDone}
                    disabled={!value || !validateInput(value)}
                  >
                    Done
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false)
                      setValue(initialValue)
                      setError(null)
                      if (!initialValue) {
                        setEnabled(false)
                        onSave("")
                        toast({
                          title: "Disabled",
                          description: `${label} has been disabled.`,
                          status: "info",
                        })
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <a className="text-sm">{value}</a>
              {!hideActionButtons && (
                <Button size="sm" variant="ghost" onClick={handleEdit}>
                  <Pencil className="size-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EditableUrlInput

import { Button, Input } from "@formlink/ui"
import { Plus } from "lucide-react"
import React, { useEffect, useState } from "react"
import { BUTTON_CLASSES } from "../constants"
import { AddOptionInputProps } from "../types"

export const AddOptionInput: React.FC<AddOptionInputProps> = ({
  labelPlaceholder,
  valuePlaceholder,
  onAdd,
  buttonLabel = "Add",
  labelInputRef,
  valueInputRef,
}) => {
  const [labelValue, setLabelValue] = useState("")
  const [valueValue, setValueValue] = useState("")

  useEffect(() => {
    if (labelInputRef?.current) {
      labelInputRef.current.focus()
    }
  }, [labelInputRef])

  const handleAddClick = () => {
    if (labelValue.trim() && valueValue.trim()) {
      onAdd({ label: labelValue.trim(), value: valueValue.trim() })
      setLabelValue("")
      setValueValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddClick()
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Input
        ref={labelInputRef}
        type="text"
        placeholder={labelPlaceholder}
        value={labelValue}
        onChange={(e) => setLabelValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 rounded-full text-xs"
      />
      <Input
        ref={valueInputRef}
        type="text"
        placeholder={valuePlaceholder}
        value={valueValue}
        onChange={(e) => setValueValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 rounded-full text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleAddClick}
        className={`${BUTTON_CLASSES.base} self-end`}
      >
        <Plus size={14} className="mr-1" /> {buttonLabel}
      </Button>
    </div>
  )
}

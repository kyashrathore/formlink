import { Button, Input, Loader } from "@formlink/ui"
import { Plus } from "lucide-react"
import React, { useEffect, useState } from "react"
import { BUTTON_CLASSES } from "../constants"
import { AddItemInputProps } from "../types"

export const AddItemInput: React.FC<AddItemInputProps> = ({
  placeholder,
  onAdd,
  buttonLabel = "Add",
  inputRef,
  loading = false,
}) => {
  const [inputValue, setInputValue] = useState("")

  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.focus()
    }
  }, [inputRef])

  const handleAddClick = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim())
      setInputValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddClick()
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 flex-grow text-xs"
        disabled={loading}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleAddClick}
        className={BUTTON_CLASSES.base}
        disabled={loading}
      >
        {loading ? <Loader /> : <Plus size={14} className="mr-1" />}
        {buttonLabel}
      </Button>
    </div>
  )
}

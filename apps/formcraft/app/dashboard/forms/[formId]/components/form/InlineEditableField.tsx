import { cn } from "@/lib/utils"
import InlineEdit from "@atlaskit/inline-edit"
import { Input, Label, Textarea } from "@formlink/ui"
import React from "react"

interface InlineEditableFieldProps {
  label?: string

  id: string

  defaultValue: string | undefined

  onConfirm: (value: string) => void

  placeholder?: string

  isRequired?: boolean

  isCompact?: boolean

  hideLabel?: boolean

  className?: string

  useTextArea?: boolean
}

const InlineEditableField: React.FC<InlineEditableFieldProps> = ({
  label,
  id,
  defaultValue,
  onConfirm,
  placeholder = "Click to edit",
  isRequired = false,
  isCompact = false,
  hideLabel = false,
  className,
  useTextArea = false,
}) => {
  const displayValue = defaultValue ?? ""

  return (
    <div className={cn("inline-edit-wrapper w-full", className)}>
      {!hideLabel && label && (
        <Label
          htmlFor={id}
          className="text-muted-foreground mb-1 block text-xs font-medium"
        >
          {label} {isRequired && <span className="text-destructive">*</span>}
        </Label>
      )}
      <InlineEdit<string>
        defaultValue={displayValue}
        onConfirm={onConfirm}
        readView={() => (
          <div
            className={cn(
              "read-view bg-muted/100 min-h-[28px] w-full cursor-text rounded-sm border border-transparent px-2 py-1 text-sm transition-colors hover:rounded-sm",
              !displayValue && "text-muted-foreground italic",
              isCompact && "min-h-[20px] px-1 py-0.5 text-xs"
            )}
            title={placeholder}
          >
            {displayValue || placeholder}
          </div>
        )}
        editView={(props, ref) =>
          useTextArea ? (
            <Textarea
              {...props}
              ref={ref as React.Ref<HTMLTextAreaElement>}
              className="mx-auto w-[calc(100%-16px)]"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onConfirm(props.value)
                }
              }}
              onChange={(e) => props.onChange(e.target.value)}
            />
          ) : (
            <Input
              {...props}
              ref={ref as React.Ref<HTMLInputElement>}
              autoFocus
            />
          )
        }
        keepEditViewOpenOnBlur={false}
        editButtonLabel={label ? `Edit ${label}` : "Edit"}
        confirmButtonLabel={label ? `Save ${label}` : "Save"}
      />
    </div>
  )
}

export default InlineEditableField

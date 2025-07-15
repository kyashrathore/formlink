import { Option, Question } from "@formlink/schema"

export interface QuestionDetailProps {
  question: Question | null
  userId: string
  selectedTab?: string
}

export interface AddItemInputProps {
  placeholder: string
  onAdd: (value: string) => void
  buttonLabel?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  loading?: boolean
}

export interface AddOptionInputProps {
  labelPlaceholder: string
  valuePlaceholder: string
  onAdd: (item: { label: string; value: string }) => void
  buttonLabel?: string
  labelInputRef?: React.RefObject<HTMLInputElement | null>
  valueInputRef?: React.RefObject<HTMLInputElement | null>
}

export interface DeletableBadgeProps {
  items: string[] | Option[] | undefined
  onDelete: (index: number) => void
  variant?: "default" | "secondary" | "destructive" | "outline"
  className?: string
  isOption?: boolean
}

export interface SectionHeaderProps {
  icon: React.ElementType
  title: string
}

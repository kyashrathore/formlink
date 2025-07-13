import { AlertTriangle, GitBranch, List, Star } from "lucide-react"

export const SECTION_ICONS = {
  options: List,
  validations: AlertTriangle,
  conditionalLogic: GitBranch,
  rating: Star,
} as const

export const INPUT_TYPES = {
  option: "option",
  validation: "validation",
  condition: "condition",
} as const

export type InputType = keyof typeof INPUT_TYPES | null

export const BUTTON_CLASSES = {
  base: "h-8 text-xs rounded-full",
  addButton: "mt-2 h-8 text-xs rounded-full",
} as const

export const BADGE_VARIANTS = {
  default: "default",
  secondary: "secondary",
  destructive: "destructive",
  outline: "outline",
} as const

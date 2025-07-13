"use client"

import { useHotKey } from "@/app/hooks/use-hot-key"
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formlink/ui"
import { X } from "lucide-react"
import { Kbd } from "../custom/kbd"
import { useDataTable } from "./data-table-provider"

export function DataTableResetButton() {
  const { table } = useDataTable()
  useHotKey(() => table?.resetColumnFilters(), "Escape")

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table?.resetColumnFilters()}
          >
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>
            Reset filters with{" "}
            <Kbd className="text-muted-foreground group-hover:text-accent-foreground ml-1">
              <span className="mr-1">⌘</span>
              <span>Esc</span>
            </Kbd>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

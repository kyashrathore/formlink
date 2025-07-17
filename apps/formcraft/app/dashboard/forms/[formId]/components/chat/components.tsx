import { Button, ChatContainer, ScrollButton } from "@formlink/ui"
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Eye,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import React, { forwardRef, useRef, useState } from "react"
import { MessageWithParts } from "./MessageWithParts"
import type { AgentState, ChatMessage, FormattedLogEvent } from "./types"
import { formatChatMessageTime } from "./utils"

interface TaskProgressProps {
  currentTask: number
  totalTasks: number
}

export const TaskProgress: React.FC<TaskProgressProps> = ({
  currentTask,
  totalTasks,
}) => {
  const progressPercentage =
    totalTasks > 0 ? (currentTask / totalTasks) * 100 : 0
  const showProgress = totalTasks > 0 || currentTask > 0

  const alwaysShow = false

  if (!showProgress && !alwaysShow) return null

  const filledBlocks = Math.floor((progressPercentage / 100) * 10)

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-xs border ${
              index < filledBlocks
                ? "!bg-primary !border-primary"
                : "bg-muted border-border"
            }`}
          />
        ))}
      </div>
      <span className="text-muted-foreground text-xs font-medium">
        {currentTask}/{totalTasks || "?"}
      </span>
    </div>
  )
}

interface CollapsedPanelProps {
  displaySummaryMessage: string
  onExpand: () => void
  isStreaming?: boolean
}

export const CollapsedPanel: React.FC<CollapsedPanelProps> = ({
  displaySummaryMessage,
  onExpand,
  isStreaming = false,
}) => (
  <Button
    variant="outline"
    className="!bg-popover/80 flex h-auto w-full items-center justify-start rounded-xl px-3 py-2 text-left backdrop-blur-sm"
    aria-expanded={false}
    onClick={onExpand}
  >
    <Activity className="text-muted-foreground h-4 w-4 flex-shrink-0 md:h-5 md:w-5" />
    <span className="ml-2 truncate font-medium">{displaySummaryMessage}</span>
  </Button>
)

interface PanelHeaderProps {
  onCollapse: () => void
  currentTask: number
  totalTasks: number
  shortId: string
  isStreaming?: boolean
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  onCollapse,
  shortId,
  currentTask,
  totalTasks,
  isStreaming = false,
}) => (
  <div className="flex items-center justify-between px-3 pt-3 pb-2">
    <div className="flex items-center gap-3">
      <Activity className="text-muted-foreground h-4 w-4 sm:h-5 sm:w-5" />
      <span className="text-foreground truncate text-sm font-semibold">
        Chat & Logs
      </span>
      <TaskProgress currentTask={currentTask} totalTasks={totalTasks} />
    </div>
    <div className="flex items-center gap-2">
      {shortId && (
        <Link
          title="Preview"
          href={`http://localhost:3001/${shortId}?formlinkai_testmode=true`}
          target="_blank"
        >
          <Eye />
        </Link>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Collapse"
        onClick={onCollapse}
      >
        <ChevronDown className="text-muted-foreground h-5 w-5" />
      </Button>
    </div>
  </div>
)

interface ChatMessagesComponentProps {
  chatMessages: ChatMessage[]
}

export const ChatMessages = forwardRef<
  HTMLDivElement,
  ChatMessagesComponentProps
>(({ chatMessages }, forwardedRef) => {
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const internalContainerRef = useRef<HTMLDivElement>(null)

  if (!chatMessages || chatMessages.length === 0) {
    return null
  }

  return (
    <div className="relative m-1">
      <ChatContainer
        ref={
          typeof forwardedRef === "function"
            ? undefined
            : forwardedRef || internalContainerRef
        }
        scrollToRef={scrollAnchorRef}
        autoScroll={true}
        className="bg-background max-h-60 overflow-y-auto rounded-lg p-3"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        {chatMessages?.map((message, index) => {
          return (
            <MessageWithParts
              key={index}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              parts={(message as any).parts}
              isLastMessage={index === chatMessages.length - 1}
            />
          )
        })}
        <div ref={scrollAnchorRef} style={{ height: "1px" }} />
      </ChatContainer>
      <ScrollButton
        className="absolute right-2 bottom-2"
        scrollRef={scrollAnchorRef}
        containerRef={
          typeof forwardedRef === "function" || forwardedRef === null
            ? internalContainerRef
            : forwardedRef
        }
      />
    </div>
  )
})
ChatMessages.displayName = "ChatMessages"

interface EventLogsProps {
  logsToShow: FormattedLogEvent[]
  containerRef: React.RefObject<HTMLDivElement | null>
  onCollapse?: () => void
}

export const EventLogs: React.FC<EventLogsProps> = ({
  logsToShow,
  containerRef,
  onCollapse,
}) => (
  <div
    ref={containerRef}
    className="bg-background border-border relative m-1 max-h-40 overflow-y-auto rounded-lg border p-2 shadow-inner"
  >
    {onCollapse && (
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 h-6 w-6"
        onClick={onCollapse}
        aria-label="Collapse logs"
      >
        <ChevronDown className="text-muted-foreground h-4 w-4 rotate-180" />
      </Button>
    )}
    {logsToShow.length === 0 ? (
      <div className="text-muted-foreground p-2 text-sm">
        No detailed logs yet.
      </div>
    ) : (
      logsToShow.map((log, index) => (
        <div
          key={index}
          className="text-muted-foreground border-border/50 border-b p-1.5 pr-8 font-mono text-xs"
        >
          {log.formattedContent}
        </div>
      ))
    )}
  </div>
)

interface FailedStateProps {
  onRetry: () => void
}

export const FailedState: React.FC<FailedStateProps> = ({ onRetry }) => (
  <div className="flex items-center justify-between rounded-xl border p-3 shadow-lg">
    <div className="flex items-center">
      <AlertTriangle className="mr-2 h-5 w-5" />
      <span>Form generation failed.</span>
    </div>
    <Button
      variant="outline"
      size="sm"
      onClick={onRetry}
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      Retry
    </Button>
  </div>
)

export interface ExpandedPanelProps {
  chatMessages?: ChatMessage[]
  logsToShow: FormattedLogEvent[]
  chatContainerRef?: React.RefObject<HTMLDivElement | null>
  logsContainerRef: React.RefObject<HTMLDivElement | null>
  onCollapse: () => void
  displaySummaryMessage: string
  currentTask: number
  totalTasks: number
  shortId: string
  isStreaming?: boolean
}

export const ExpandedPanel: React.FC<ExpandedPanelProps> = ({
  chatMessages,
  logsToShow,
  chatContainerRef,
  logsContainerRef,
  onCollapse,
  displaySummaryMessage,
  currentTask,
  totalTasks,
  shortId,
  isStreaming = false,
}) => {
  const [showDetailedLogs, setShowDetailedLogs] = useState(false)

  return (
    <div className="bg-popover/80 border-border flex flex-col rounded-xl border shadow-lg backdrop-blur-sm">
      <PanelHeader
        onCollapse={onCollapse}
        currentTask={currentTask}
        totalTasks={totalTasks}
        shortId={shortId}
        isStreaming={isStreaming}
      />
      {chatMessages && chatMessages.length > 0 && (
        <ChatMessages chatMessages={chatMessages} ref={chatContainerRef} />
      )}

      {!showDetailedLogs && (
        <div className="p-1">
          <Button
            variant="outline"
            className="!bg-background flex h-auto w-full items-center justify-start rounded-lg px-3 py-2 text-left"
            onClick={() => setShowDetailedLogs(true)}
            aria-expanded={false}
          >
            <Activity className="text-muted-foreground mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            {displaySummaryMessage}
            <ChevronDown className="text-muted-foreground ml-auto h-5 w-5" />
          </Button>
        </div>
      )}

      {showDetailedLogs && (
        <EventLogs
          logsToShow={logsToShow}
          containerRef={logsContainerRef}
          onCollapse={() => setShowDetailedLogs(false)}
        />
      )}
    </div>
  )
}

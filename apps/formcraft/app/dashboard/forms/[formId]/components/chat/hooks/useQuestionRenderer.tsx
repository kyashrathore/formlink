import { Element } from "hast"
import React, { ComponentProps } from "react"
import { QuestionWrapper } from "../QuestionWrapper"

export const useQuestionRenderer = (
  messageId: string,
  isLast?: boolean,
  variant: "user" | "assistant" = "assistant",
  handleFileUpload?: (questionId: string, file: File) => Promise<void>,
  onSubmitSelection?: (
    questionId: string,
    value: any,
    displayText: string
  ) => Promise<void>
) => {
  const components = {
    p: ({
      node,
      children,
      ...props
    }: ComponentProps<"p"> & { node?: Element }) => {
      if (!node) return null
      const hasQuestionLink = node.children.some(
        (child: Element | { type: string }) => {
          if (
            child.type !== "element" ||
            !("tagName" in child) ||
            child.tagName !== "a"
          )
            return false
          const linkNode = (child as Element).children?.[0]
          return linkNode?.type === "text" && linkNode.value === "question"
        }
      )

      if (hasQuestionLink) {
        // Don't render the paragraph content, just render children which will be our QuestionWrapper
        return <>{children}</>
      }
      return <p {...props}>{children}</p>
    },
    a: ({ node, ...props }: ComponentProps<"a"> & { node?: Element }) => {
      const linkText =
        node?.children?.[0]?.type === "text" ? node.children[0].value : ""

      if (linkText === "question" && props.href) {
        // Handle both full URLs and relative URLs like "url?qId=xxx"
        let questionId = ""
        try {
          // First try as a full URL
          const url = new URL(props.href)
          questionId = url.searchParams.get("qId") || ""
        } catch {
          // If that fails, try to extract qId from the string directly
          const match = props.href.match(/[?&]qId=([^&]+)/)
          questionId = match?.[1] || ""
        }

        if (!questionId) return null

        return (
          <QuestionWrapper
            questionId={questionId}
            messageId={messageId}
            isLast={isLast}
            variant={variant}
            handleFileUpload={handleFileUpload}
            onSubmitSelection={onSubmitSelection}
          />
        )
      }
      return <a {...props} target="_blank" rel="noopener noreferrer" />
    },
  }

  return { components }
}

import React from "react";
import { Element } from "hast";
import { QuestionWrapper } from "../QuestionWrapper";

export const useQuestionRenderer = (
  messageId: string,
  isLast?: boolean,
  variant: "user" | "assistant" = "assistant",
  handleFileUpload?: (questionId: string, file: File) => Promise<void>,
) => {
  const components = {
    p: ({ node, children, ...props }: any) => {
      if (!node) return null;
      const hasQuestionLink = node.children.some((child: any) => {
        if (child.type !== "element" || child.tagName !== "a") return false;
        const linkNode = (child as Element).children?.[0];
        return linkNode?.type === "text" && linkNode.value === "question";
      });

      if (hasQuestionLink) {
        // Don't render the paragraph content, just render children which will be our QuestionWrapper
        return <>{children}</>;
      }
      return <p {...props}>{children}</p>;
    },
    a: ({ node, ...props }: any) => {
      const linkText =
        node?.children?.[0]?.type === "text" ? node.children[0].value : "";

      if (linkText === "question" && props.href) {
        const url = new URL(props.href);
        const questionId = url.searchParams.get("qId") || "";

        if (!questionId) return null;

        return (
          <QuestionWrapper
            questionId={questionId}
            messageId={messageId}
            isLast={isLast}
            variant={variant}
            handleFileUpload={handleFileUpload}
          />
        );
      }
      return <a {...props} target="_blank" rel="noopener noreferrer" />;
    },
  };

  return { components };
};

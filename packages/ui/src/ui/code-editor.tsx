"use client";

import Editor, { type EditorProps } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import * as React from "react";
import { cn } from "../lib/utils";

export interface CodeEditorProps extends Omit<EditorProps, "theme"> {
  className?: string;
  wrapperClassName?: string;
}

const CodeEditor = React.forwardRef<HTMLDivElement, CodeEditorProps>(
  ({ className, wrapperClassName, ...props }, ref) => {
    const { systemTheme, theme } = useTheme();
    const appliedTheme = theme === "system" ? systemTheme : theme;
    const monacoTheme = appliedTheme === "dark" ? "vs-dark" : "vs";

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-md border",
          wrapperClassName,
        )}
      >
        <Editor
          theme={monacoTheme}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            ...props.options,
          }}
          className={cn("h-full w-full", className)}
          {...props}
        />
      </div>
    );
  },
);
CodeEditor.displayName = "CodeEditor";

export { CodeEditor };

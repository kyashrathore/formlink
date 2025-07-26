"use client"

import { Button } from "@formlink/ui"
import { AlertCircle } from "lucide-react"
import React, { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  section?: string
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (
      typeof window !== "undefined" &&
      (
        window as {
          posthog?: {
            capture: (event: string, data: Record<string, unknown>) => void
          }
        }
      ).posthog
    ) {
      ;(
        window as {
          posthog?: {
            capture: (event: string, data: Record<string, unknown>) => void
          }
        }
      ).posthog!.capture("error_boundary_triggered", {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
        section: this.props.section,
      })
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="text-destructive mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">Something went wrong</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {this.props.section
              ? `We encountered an error loading the ${this.props.section} section.`
              : "We encountered an unexpected error."}
          </p>
          <Button onClick={this.handleReset} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

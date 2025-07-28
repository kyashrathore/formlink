/**
 * Analytics tracking for form generation performance and errors
 */

import { isFeatureEnabled } from "@/app/lib/feature-flags"

export class FormGenerationAnalytics {
  private startTime: number | null = null
  private sectionTimes: Map<string, number> = new Map()
  private formId: string | null = null

  /**
   * Start tracking form generation
   */
  trackGenerationStart(formId: string) {
    this.formId = formId
    this.startTime = Date.now()
    this.sectionTimes.clear()

    this.track("form_generation_started", { formId })
  }

  /**
   * Track when a section starts loading
   */
  trackSectionStart(section: "metadata" | "journey" | "questions") {
    this.sectionTimes.set(section, Date.now())

    this.track("form_generation_section_start", {
      section,
      formId: this.formId,
    })
  }

  /**
   * Track when a section completes
   */
  trackSectionComplete(section: "metadata" | "journey" | "questions") {
    const startTime = this.sectionTimes.get(section) || this.startTime
    const duration = startTime ? Date.now() - startTime : null

    this.track("form_generation_section_complete", {
      section,
      duration,
      formId: this.formId,
    })
  }

  /**
   * Track errors
   */
  trackError(section: string, error: Error, retryCount?: number) {
    this.track("form_generation_error", {
      section,
      error: error.message,
      errorStack: error.stack,
      formId: this.formId,
      retryCount,
    })
  }

  /**
   * Track generation completion
   */
  trackGenerationComplete(stats: {
    metadataSuccess: boolean
    journeySuccess: boolean
    questionsGenerated: number
    questionsTotal: number
  }) {
    const totalDuration = this.startTime ? Date.now() - this.startTime : null

    this.track("form_generation_completed", {
      formId: this.formId,
      totalDuration,
      ...stats,
      completionRate:
        stats.questionsTotal > 0
          ? (stats.questionsGenerated / stats.questionsTotal) * 100
          : 0,
    })
  }

  /**
   * Track user interactions
   */
  trackUserAction(action: string, data?: Record<string, any>) {
    this.track(`form_generation_user_${action}`, {
      formId: this.formId,
      ...data,
    })
  }

  /**
   * Track performance metrics
   */
  trackPerformance(
    metric: string,
    value: number,
    metadata?: Record<string, any>
  ) {
    this.track("form_generation_performance", {
      metric,
      value,
      formId: this.formId,
      ...metadata,
    })
  }

  /**
   * Core tracking method
   */
  private track(eventName: string, data?: Record<string, any>) {
    if (!isFeatureEnabled("FORM_GENERATION_ANALYTICS")) {
      return
    }

    const eventData = {
      timestamp: new Date().toISOString(),
      ...data,
    }

    // Log in development
    if (process.env.NODE_ENV === "development") {
      // noop
    }

    // Send to analytics service
    if (typeof window !== "undefined") {
      // PostHog integration
      if ((window as any).posthog) {
        ;(window as any).posthog.capture(eventName, eventData)
      }

      // Generic analytics integration
      if ((window as any).analytics) {
        ;(window as any).analytics.track(eventName, eventData)
      }
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const sections = ["metadata", "journey", "questions"]
    const sectionDurations: Record<string, number | null> = {}

    for (const section of sections) {
      const startTime = this.sectionTimes.get(section)
      if (startTime) {
        sectionDurations[section] = Date.now() - startTime
      } else {
        sectionDurations[section] = null
      }
    }

    return {
      totalDuration: this.startTime ? Date.now() - this.startTime : null,
      sectionDurations,
      formId: this.formId,
    }
  }
}

// Singleton instance
export const formGenerationAnalytics = new FormGenerationAnalytics()

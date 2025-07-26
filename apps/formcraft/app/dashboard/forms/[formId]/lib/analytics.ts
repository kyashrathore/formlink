import posthog from "posthog-js"

const shouldDisableAnalytics = () => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return true
  }

  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userId") || sessionStorage.getItem("userId") || ""
      : ""
  if (
    userId === "dsfsdf" ||
    userId.includes("dsfsdf") ||
    userId === "ac7f4c28-e255-4551-a418-ce2630af2ce8" ||
    userId.includes("ac7f4c28-e255-4551-a418-ce2630af2ce8")
  ) {
    return true
  }

  return false
}

export const analytics = {
  userSignedUp: (method: "email" | "google", referrer: string) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("user_signed_up", {
      method,
      referrer,
    })
  },

  formCreationStarted: (method: "ai_chat" | "blank" | "template") => {
    if (shouldDisableAnalytics()) return
    posthog.capture("form_creation_started", {
      method,
    })
  },

  aiAgentStarted: (inputType: "text" | "url" | "file", inputLength: number) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("ai_agent_started", {
      input_type: inputType,
      input_length: inputLength,
    })
  },

  aiAgentEventReceived: (eventType: string, taskName?: string) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("ai_agent_event_received", {
      event_type: eventType,
      task_name: taskName,
    })
  },

  formGenerated: (
    success: boolean,
    questionsCount: number,
    generationTime: number,
    errorType?: string
  ) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("form_generated", {
      success,
      questions_count: questionsCount,
      generation_time: generationTime,
      error_type: errorType,
    })
  },

  questionAdded: (questionType: string, currentTotal: number) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("question_added", {
      question_type: questionType,
      current_total: currentTotal,
    })
  },

  questionDeleted: (questionType: string, remainingTotal: number) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("question_deleted", {
      question_type: questionType,
      remaining_total: remainingTotal,
    })
  },

  formPublished: (
    formId: string,
    questionsCount: number,
    hasJourneyScript: boolean,
    timeToPublish: number
  ) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("form_published", {
      form_id: formId,
      questions_count: questionsCount,
      has_journey_script: hasJourneyScript,
      time_to_publish: timeToPublish,
    })
  },

  journeyScriptViewed: (formId: string) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("journey_script_viewed", {
      form_id: formId,
    })
  },

  journeyScriptEdited: (formId: string, editMode: "manual" | "template") => {
    if (shouldDisableAnalytics()) return
    posthog.capture("journey_script_edited", {
      form_id: formId,
      edit_mode: editMode,
    })
  },

  journeyScriptSaved: (formId: string, scriptLength: number) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("journey_script_saved", {
      form_id: formId,
      script_length: scriptLength,
    })
  },

  formLinkCopied: (formId: string) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("form_link_copied", {
      form_id: formId,
    })
  },

  embedCodeCopied: (formId: string) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("embed_code_copied", {
      form_id: formId,
    })
  },

  responsesViewed: (formId: string, responsesCount: number) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("responses_viewed", {
      form_id: formId,
      responses_count: responsesCount,
    })
  },

  landingCTAClicked: (
    ctaType: "start_free" | "go_dashboard",
    userType: "anonymous" | "authenticated" | "unauthenticated",
    location: "header" | "hero" | "pricing"
  ) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("landing_cta_clicked", {
      cta_type: ctaType,
      user_type: userType,
      location,
    })
  },

  promptSuggestionClicked: (
    suggestionTitle: string,
    suggestionIndex: number
  ) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("prompt_suggestion_clicked", {
      suggestion_title: suggestionTitle,
      suggestion_index: suggestionIndex,
    })
  },

  themeSwitcherUsed: (
    newTheme: "light" | "dark",
    location: "header" | "mobile_menu"
  ) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("theme_switcher_used", {
      new_theme: newTheme,
      location,
    })
  },

  landingSectionViewed: (sectionName: string) => {
    if (shouldDisableAnalytics()) return
    posthog.capture("landing_section_viewed", {
      section_name: sectionName,
    })
  },
}

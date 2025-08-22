import { Settings } from "@formlink/schema"

/**
 * Default settings for forms - server-safe utility without React dependencies
 * This file can be safely imported in both client and server contexts
 */
export const getDefaultSettings = (): Settings => ({
  defaultMode: "ai",
  redirectOnSubmissionUrl: "",
  creatorMailAddressOnSubmission: "",
  submissionNotificationEmail: "",
  integrations: { webhookUrl: "" },
  additionalFields: {
    queryParamater: [],
    computedFromResponses: [],
  },
})

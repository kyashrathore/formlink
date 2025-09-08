/**
 * Default placeholder mappings for TypeForm components
 * As specified in Phase 1 requirements
 */

export const DEFAULT_PLACEHOLDERS: Record<string, string> = {
  text: "Type your answer",
  textarea: "Type your answer",
  email: "name@example.com",
  url: "https://example.com",
  tel: "(555) 123-4567",
  number: "Enter a number",
  password: "Enter your password",
  country: "Search country…",
  singleChoice: "Select an option",
  multipleChoice: "Select one or more",
  rating: "Choose a rating",
  linearScale: "Choose a value",
  date: "YYYY-MM-DD",
  dateRange: "YYYY-MM-DD to YYYY-MM-DD",
  fileUpload: "Drag and drop or click to upload",
  address: "Start typing your address",
  // Note: likert and ranking have no placeholders per spec
} as const;

export function getPlaceholder(
  type: string,
  format?: string,
  customPlaceholder?: string,
): string {
  if (customPlaceholder) {
    return customPlaceholder;
  }

  if (type === "text" && format) {
    const placeholder = DEFAULT_PLACEHOLDERS[format];
    return placeholder || "Type your answer";
  }

  const placeholder = DEFAULT_PLACEHOLDERS[type];
  return placeholder || "Type your answer";
}

/**
 * Default error messages for validation
 */
export const DEFAULT_ERROR_MESSAGES = {
  required: "This field is required",
  email: "Enter a valid email address",
  url: "Enter a valid URL",
  tel: "Enter a valid phone number",
  number: "Enter a valid number",
  minLength: (count: number) => `Must be at least ${count} characters`,
  maxLength: (count: number) => `Must be ${count} or fewer characters`,
  pattern: "Answer format is invalid",
  minSelections: (count: number) => `Select at least ${count}`,
  maxSelections: (count: number) => `Select no more than ${count}`,
  dateAfter: (date: string) => `Date must be on or after ${date}`,
  dateBefore: (date: string) => `Date must be on or before ${date}`,
  fileType: "File type not allowed",
  maxFiles: (count: number) => `Max ${count} files`,
  fileSize: "File exceeds size limit",
} as const;

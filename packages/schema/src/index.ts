import { z } from "zod";

export const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  score: z.number().optional(),
});
export type Option = z.infer<typeof OptionSchema>;

export const SubmissionBehaviorSchema = z.enum([
  "autoAnswer",
  "manualAnswer",
  "manualUnclear",
]);
export type SubmissionBehavior = z.infer<typeof SubmissionBehaviorSchema>;

export const ValidationRuleSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  message: z.string().optional(),
  originalText: z
    .string()
    .optional()
    .describe("Original natural language text for this validation rule"),
});

export const QuestionValidationsSchema = z
  .object({
    required: ValidationRuleSchema.extend({ value: z.boolean() }).optional(),
    minLength: ValidationRuleSchema.extend({
      value: z.number().int().nonnegative(),
    }).optional(),
    maxLength: ValidationRuleSchema.extend({
      value: z.number().int().positive(),
    }).optional(),
    pattern: ValidationRuleSchema.extend({ value: z.string() }).optional(),
    minSelections: ValidationRuleSchema.extend({
      value: z.number().int().positive(),
    }).optional(),
    maxSelections: ValidationRuleSchema.extend({
      value: z.number().int().positive(),
    }).optional(),
    minDate: ValidationRuleSchema.extend({ value: z.string() }).optional(),
    maxDate: ValidationRuleSchema.extend({ value: z.string() }).optional(),
    maxSize: ValidationRuleSchema.extend({
      value: z.number().int().positive(),
    }).optional(),
    allowedTypes: ValidationRuleSchema.extend({
      value: z.array(z.string()),
    }).optional(),
    maxFiles: ValidationRuleSchema.extend({
      value: z.number().int().positive(),
    }).optional(),
  })
  .passthrough();
export type QuestionValidations = z.infer<typeof QuestionValidationsSchema>;

export const RatingConfigSchema = z
  .object({
    min: z.number().int().default(1),
    max: z.number().int().positive(),
    step: z.number().int().positive().default(1),
    minLabel: z.string().optional(),
    maxLabel: z.string().optional(),
  })
  .refine((data) => data.max > data.min, {
    message: "Rating 'max' must be greater than 'min'.",
    path: ["max"],
  });

export const LinearScaleConfigSchema = z
  .object({
    start: z.number().int(),
    end: z.number().int(),
    step: z.number().int().positive().default(1),
    startLabel: z.string().optional(),
    endLabel: z.string().optional(),
  })
  .refine((data) => data.end > data.start, {
    message: "Linear scale 'end' must be greater than 'start'.",
    path: ["end"],
  });

// The new, unified type object. This is a discriminated union.
const QuestionTypeSchema = z.discriminatedUnion("name", [
  // Text-based questions
  z.object({
    name: z.literal("text"),
    format: z.enum([
      "text",
      "textarea",
      "email",
      "url",
      "tel",
      "number",
      "password",
      "country",
    ]),
  }),
  // Choice-based questions
  z.object({
    name: z.enum(["singleChoice", "multipleChoice"]),
    display: z.enum(["radio", "checkbox", "dropdown", "multiSelectDropdown"]),
    options: z.array(OptionSchema),
  }),
  // Rating question
  z.object({
    name: z.literal("rating"),
    config: RatingConfigSchema,
  }),
  // Date question
  z.object({
    name: z.literal("date"),
    format: z.enum(["date", "dateRange"]),
  }),
  // Ranking question
  z.object({
    name: z.literal("ranking"),
    options: z.array(OptionSchema),
  }),
  // File Upload question
  z.object({
    name: z.literal("fileUpload"),
  }),
  // Address question
  z.object({
    name: z.literal("address"),
  }),
  // Linear Scale question
  z.object({
    name: z.literal("linearScale"),
    config: LinearScaleConfigSchema,
  }),
  // Likert Scale question
  z.object({
    name: z.literal("likertScale"),
    options: z.array(z.string()),
  }),
]);

export const AddressSchema = z.object({
  street1: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});
export type AddressData = z.infer<typeof AddressSchema>;

const JSONataConditionSchema = z.object({
  prompt: z.string(),
  jsonata: z.string(),
});

// The new, simplified QuestionSchema
export const QuestionSchema = z.object({
  id: z.string().min(1),
  questionNo: z.number(),
  title: z.string(),
  description: z.string().optional(),

  // Base properties from our Classic Mode feature work
  label: z.string().optional(),
  page: z.number().int().optional(),
  styling: z
    .object({ colSpan: z.number().int().min(1).max(12).optional() })
    .optional(),
  isCheckpoint: z.boolean().optional(),

  // The new, unified type property
  type: QuestionTypeSchema,

  // Other base properties that remain at the top level
  validations: QuestionValidationsSchema.optional().default({}),
  conditionalLogic: JSONataConditionSchema.optional(),
  defaultValue: z
    .union([
      z.string(),
      z.number(),
      z.array(z.string()),
      AddressSchema,
      z.null(),
    ])
    .optional(),
  submissionBehavior: SubmissionBehaviorSchema,
  readableValidations: z
    .array(z.string())
    .optional()
    .describe(
      "Human-readable descriptions of validation rules (e.g., 'This question is required.')",
    ),
  readableConditionalLogic: z
    .array(z.string())
    .optional()
    .describe(
      "Human-readable descriptions of conditional logic rules (e.g., 'Show if Q1 equals Yes')",
    ),
  // Additional readable config fields for specific question types
  readableRankingConfig: z
    .string()
    .optional()
    .describe(
      "Human-readable description of ranking rules (e.g., 'Rank your top 3 choices')",
    ),
  readableRatingConfig: z
    .string()
    .optional()
    .describe(
      "Human-readable description of the rating scale (e.g., 'Rate from 1 (Low) to 5 (High)')",
    ),
  readableLikertConfig: z
    .string()
    .optional()
    .describe(
      "Human-readable description of the Likert scale (e.g., 'Rate your agreement from Strongly Disagree to Strongly Agree')",
    ),
});

export const SettingsSchema = z
  .object({
    resultPageGenerationPrompt: z.string().optional(),
    journeyScript: z.string().optional(),
    additionalFields: z
      .object({
        queryParamater: z.array(z.string()),
        computedFromResponses: z.array(
          z.object({
            field_id: z.string(),
            prompt: z.string(),
            jsonata: z.string(),
          }),
        ),
      })
      .optional(),
    redirectOnSubmissionUrl: z.string().optional(),
    submissionNotificationEmail: z.string().optional(),
    integrations: z
      .object({
        webhookUrl: z.string().optional(),
      })
      .optional(),
    branching: z
      .object({
        enabled: z.boolean().optional().default(false),
      })
      .optional(),
  })
  .passthrough();
export type Settings = z.infer<typeof SettingsSchema>;

export const FormSchema = z.object({
  current_published_version_id: z.string().optional().nullable(),
  current_draft_version_id: z.string().optional().nullable(),
  version_id: z.string().min(1),
  id: z.string().min(1),
  short_id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  questions: z.array(QuestionSchema),
  settings: SettingsSchema.optional(),
});

export type Question = z.infer<typeof QuestionSchema>;
export type Form = z.infer<typeof FormSchema>;

export type BaseEditableQuestionField = keyof Pick<
  Question,
  "title" | "description"
>;

/**
 * EditableQuestionField:
 * - For all questions: "title" | "description" | "questionType"
 * - For rating questions: also "readableRatingConfig"
 */
export type EditableQuestionField =
  | "title"
  | "description"
  | "type"
  | "readableRatingConfig";

export type EditableFormField = keyof Pick<Form, "title" | "description">;

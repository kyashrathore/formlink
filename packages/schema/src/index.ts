import { z } from "zod";

export const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  score: z.number().optional(),
});
export type Option = z.infer<typeof OptionSchema>;

export const QuestionTypeEnumSchema = z.enum([
  "multipleChoice",
  "singleChoice",
  "text",
  "date",
  "rating",
  "address",
  "ranking",
  "fileUpload",
  "linearScale",
  "likertScale",
]);
export type QuestionType = z.infer<typeof QuestionTypeEnumSchema>;

const InputTypeEnumSchema = z.enum([
  "checkbox",
  "radio",
  "dropdown",
  "multiSelectDropdown",
  "text",
  "textarea",
  "email",
  "url",
  "tel",
  "country",
  "number",
  "password",
  "date",
  "dateRange",
  "star",
  "linearScale",
  "file",
  "addressBlock",
  "rankOrder",
  "likertScale",
]);
export type InputType = z.infer<typeof InputTypeEnumSchema>;

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

export const AddressSchema = z.object({
  street1: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});
export type AddressData = z.infer<typeof AddressSchema>;

const QuestionDisplaySchema = z.object({
  inputType: InputTypeEnumSchema,
  showTitle: z.boolean().optional().default(true),
  showDescription: z.boolean().optional().default(true),
});

const JSONataConditionSchema = z.object({
  prompt: z.string(),
  jsonata: z.string(),
});

const BaseQuestionSchema = z.object({
  type: z.literal("question").default("question"),
  id: z.string().min(1),
  questionNo: z.number(),
  title: z.string(),
  description: z.string().optional(),

  validations: QuestionValidationsSchema.optional().default({}),
  display: QuestionDisplaySchema,
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
      "Human-readable descriptions of validation rules (e.g., 'This question is required.')"
    ),
  readableConditionalLogic: z
    .array(z.string())
    .optional()
    .describe(
      "Human-readable descriptions of conditional logic rules (e.g., 'Show if Q1 equals Yes')"
    ),
});

export const ChoiceQuestionSchema = BaseQuestionSchema.extend({
  questionType: z.enum(["multipleChoice", "singleChoice"]),
  options: z
    .array(OptionSchema)
    .min(1, "Choice questions must have at least one option."),
});

export const RankingQuestionSchema = BaseQuestionSchema.extend({
  questionType: z.literal("ranking"),
  options: z
    .array(OptionSchema)
    .min(1, "Ranking questions must have at least one option."),
  readableRankingConfig: z
    .string()
    .optional()
    .describe(
      "Human-readable description of ranking rules (e.g., 'Rank your top 3 choices')"
    ),
});

export const RatingQuestionSchema = BaseQuestionSchema.extend({
  questionType: z.literal("rating"),
  ratingConfig: RatingConfigSchema,
  readableRatingConfig: z
    .string()
    .optional()
    .describe(
      "Human-readable description of the rating scale (e.g., 'Rate from 1 (Low) to 5 (High)')"
    ),
});

export const LinearScaleQuestionSchema = BaseQuestionSchema.extend({
  questionType: z.literal("linearScale"),
  linearScaleConfig: LinearScaleConfigSchema,
});

export const LikertScaleQuestionSchema = BaseQuestionSchema.extend({
  questionType: z.literal("likertScale"),
  options: z
    .array(z.string())
    .min(2, "Likert scale questions must have at least two options.")
    .max(7, "Likert scale questions should have at most seven options."),
  readableLikertConfig: z
    .string()
    .optional()
    .describe(
      "Human-readable description of the Likert scale (e.g., 'Rate your agreement from Strongly Disagree to Strongly Agree')"
    ),
});

export const SimpleQuestionSchema = BaseQuestionSchema.extend({
  questionType: z.enum(["text", "date", "address", "fileUpload"]),
});

export const QuestionSchema = z
  .discriminatedUnion("questionType", [
    ChoiceQuestionSchema,
    RankingQuestionSchema,
    RatingQuestionSchema,
    LinearScaleQuestionSchema,
    LikertScaleQuestionSchema,
    SimpleQuestionSchema,
  ])
  .superRefine((data, ctx) => {
    const { questionType, display, submissionBehavior, defaultValue } = data;

    const allowedInputTypesMap: Partial<Record<QuestionType, InputType[]>> = {
      multipleChoice: ["checkbox", "multiSelectDropdown"],
      singleChoice: ["radio", "dropdown"],
      text: [
        "text",
        "textarea",
        "email",
        "url",
        "tel",
        "number",
        "password",
        "country",
      ],
      date: ["date", "dateRange"],
      rating: ["star"],
      linearScale: ["linearScale"],
      likertScale: ["likertScale"],
      address: ["addressBlock"],
      ranking: ["rankOrder"],
      fileUpload: ["file"],
    };

    const allowed = allowedInputTypesMap[questionType];

    if (allowed && !allowed.includes(display.inputType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["display", "inputType"],
        message: `Input type '${display.inputType}' is not valid for question type '${questionType}'. Allowed: ${allowed.join(", ")}`,
      });
    }

    if ("options" in data && data.options && data.options.length > 0) {
      if (
        data.options.length < 4 &&
        (display.inputType === "dropdown" ||
          display.inputType === "multiSelectDropdown")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["display", "inputType"],
          message: `Input type '${display.inputType}' is typically used for >=4 options. Consider 'radio' or 'checkbox'.`,
        });
      } else if (
        data.options.length >= 4 &&
        (display.inputType === "radio" || display.inputType === "checkbox")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["display", "inputType"],
          message: `Input type '${display.inputType}' is typically used for <4 options. Consider 'dropdown' or 'multiSelectDropdown'.`,
        });
      }
    }

    const expectedBehavior: Partial<Record<InputType, SubmissionBehavior>> = {
      radio: "autoAnswer",
      dropdown: "autoAnswer",
      date: "autoAnswer",
      dateRange: "autoAnswer",
      star: "autoAnswer",
      linearScale: "autoAnswer",
      likertScale: "autoAnswer",
      file: "autoAnswer",

      checkbox: "manualAnswer",
      multiSelectDropdown: "manualAnswer",
      addressBlock: "manualAnswer",
      rankOrder: "manualAnswer",

      email: "manualUnclear",
      url: "manualUnclear",
      number: "manualUnclear",
      tel: "manualUnclear",
      textarea: "manualUnclear",
      text: "manualUnclear",
      password: "manualUnclear",
      country: "manualUnclear",
    };

    const expected = expectedBehavior[display.inputType];
    if (expected && submissionBehavior !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["submissionBehavior"],
        message: `Submission behavior '${submissionBehavior}' is unexpected for input type '${display.inputType}'. Expected '${expected}'.`,
      });
    }

    if (questionType === "address" && defaultValue) {
      const parseResult = AddressSchema.safeParse(defaultValue);
      if (!parseResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["defaultValue"],
          message: "Default value for address must be a valid Address object.",
        });
      }
    }
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
          })
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
  z.infer<typeof BaseQuestionSchema>,
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
  | "questionType"
  | "readableRatingConfig";

export type EditableFormField = keyof Pick<Form, "title" | "description">;

export * from "./questionRepair";

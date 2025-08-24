import { z } from "zod";

// Define OptionSchema locally to avoid circular import
const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  score: z.number(),
});

// Individual question type schemas for composition and partial updates

export const TextQuestionSchema = z.object({
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
});

export const ChoiceQuestionSchema = z.object({
  name: z.enum(["singleChoice", "multipleChoice"]),
  display: z.enum(["radio", "checkbox", "dropdown", "multiSelectDropdown"]),
  options: z.array(OptionSchema),
});

export const RatingQuestionSchema = z.object({
  name: z.literal("rating"),
  config: z
    .object({
      min: z.number().int(),
      max: z.number().int().positive(),
      step: z.number().int().positive(),
      minLabel: z.string().optional(),
      maxLabel: z.string().optional(),
    })
    .refine((data) => data.max > data.min, {
      message: "Rating 'max' must be greater than 'min'.",
      path: ["max"],
    }),
});

export const DateQuestionSchema = z.object({
  name: z.literal("date"),
  format: z.enum(["date", "dateRange"]),
});

export const RankingQuestionSchema = z.object({
  name: z.literal("ranking"),
  options: z.array(OptionSchema),
});

export const FileUploadQuestionSchema = z.object({
  name: z.literal("fileUpload"),
});

export const AddressQuestionSchema = z.object({
  name: z.literal("address"),
});

export const LinearScaleQuestionSchema = z.object({
  name: z.literal("linearScale"),
  config: z
    .object({
      start: z.number().int(),
      end: z.number().int(),
      step: z.number().int().positive(),
      startLabel: z.string().optional(),
      endLabel: z.string().optional(),
    })
    .refine((data) => data.end > data.start, {
      message: "Linear scale 'end' must be greater than 'start'.",
      path: ["end"],
    }),
});

export const LikertScaleQuestionSchema = z.object({
  name: z.literal("likertScale"),
  options: z.array(z.string()),
});

// For backward compatibility, create a SimpleQuestionSchema that maps to TextQuestionSchema
export const SimpleQuestionSchema = TextQuestionSchema;

// Export individual types
export type TextQuestion = z.infer<typeof TextQuestionSchema>;
export type ChoiceQuestion = z.infer<typeof ChoiceQuestionSchema>;
export type RatingQuestion = z.infer<typeof RatingQuestionSchema>;
export type DateQuestion = z.infer<typeof DateQuestionSchema>;
export type RankingQuestion = z.infer<typeof RankingQuestionSchema>;
export type FileUploadQuestion = z.infer<typeof FileUploadQuestionSchema>;
export type AddressQuestion = z.infer<typeof AddressQuestionSchema>;
export type LinearScaleQuestion = z.infer<typeof LinearScaleQuestionSchema>;
export type LikertScaleQuestion = z.infer<typeof LikertScaleQuestionSchema>;
export type SimpleQuestion = z.infer<typeof SimpleQuestionSchema>;

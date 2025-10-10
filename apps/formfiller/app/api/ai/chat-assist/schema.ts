import { z } from "zod";

export const JustSavedAnswerSchema = z.object({
  questionId: z.string(),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.record(z.any()), // For address objects and other complex structures
    z.null(),
  ]),
});

export const ChatAssistBodySchema = z.object({
  submissionId: z.string().optional().nullable(),
  userInput: z.any().optional(),
  submissionBehavior: z
    .enum(["auto", "manualClear", "manualUnclear"])
    .optional()
    .nullable(),
  currentQuestionId: z.string().optional().nullable(),
  formSchema: z.any(), // validated upstream
  responses: z.record(z.any()).default({}),
  justSavedAnswer: JustSavedAnswerSchema.optional(),
  userId: z.string().optional().nullable(),
  isTestSubmission: z.boolean().optional().default(false),
  messages: z.any().optional(),
  initiate: z.boolean().optional().default(false),
  suppressUserMessagePersistence: z.boolean().optional().default(false),
  startMode: z.enum(["start", "resume"]).optional().nullable(),
});

export type ChatAssistBody = z.infer<typeof ChatAssistBodySchema>;
export type JustSavedAnswer = z.infer<typeof JustSavedAnswerSchema>;

import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Question } from "@formlink/schema";
import { decideNextQuestion } from "./_shared";

// Model provider configured in shared helper

// Request schema
const BranchingRequestSchema = z.object({
  journeyScript: z.string(),
  answerHistory: z.record(z.string(), z.any()),
  questions: z.array(z.any()), // Questions array to find valid IDs
  currentQuestionId: z.string(),
});

// Response schema
const BranchingResponseSchema = z.object({
  nextQuestionId: z.string(),
  reasoningText: z.string().optional(),
});

// System prompt for AI branching decisions
const BRANCHING_SYSTEM_PROMPT = `
You are an AI form flow director. Your job is to analyze user responses and determine the next question based on the journey script's branching logic.

## YOUR TASK:
1. Parse the journey script to find <branching_logic> section
2. Analyze the user's answer history against the branching rules
3. Return ONLY the question ID that should be shown next

## RULES:
- ONLY return question IDs that exist in the provided questions array
- If no specific branching rule applies, return the next question in sequence
- Be precise - incorrect question IDs will break the form flow
- Extract branching logic from sections marked with <branching_logic> or ## Branching Logic

## RESPONSE FORMAT:
Return a JSON object with:
- nextQuestionId: The exact ID of the next question to show
- reasoning: Brief explanation of why this question was chosen (optional)

## EXAMPLE BRANCHING LOGIC:
If the journey script contains:
"After the 'employment_status' question, if user answers 'Fresher', go to 'graduation_date'. If 'Experienced', go to 'work_experience'."

And user answered employment_status = "Fresher", you should return:
{"nextQuestionId": "graduation_date", "reasoning": "User is a fresher, directing to graduation date question"}
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate request
    const validationResult = BranchingRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { journeyScript, answerHistory, questions, currentQuestionId } =
      validationResult.data;

    // Extract question IDs for validation
    const validQuestionIds = questions.map((q: Question) => q.id);

    // Delegate to shared helper (includes linear fallback)
    const nextQuestionId = await decideNextQuestion({
      journeyScript,
      answerHistory,
      questions,
      currentQuestionId,
    });

    // Validate question ID exists
    if (!nextQuestionId || !validQuestionIds.includes(nextQuestionId)) {
      return NextResponse.json(
        {
          error: "AI returned invalid question ID",
          invalidId: nextQuestionId || null,
          validIds: validQuestionIds,
        },
        { status: 500 },
      );
    }

    // Return successful response
    return NextResponse.json({
      nextQuestionId,
      reasoningText: undefined,
      success: true,
    });
  } catch (error) {
    console.error("Branching API error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

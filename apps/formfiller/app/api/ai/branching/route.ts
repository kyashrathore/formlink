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
    console.error(
      "[branching] API error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

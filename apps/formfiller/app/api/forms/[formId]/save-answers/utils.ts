import { SupabaseClient, Database } from "@formlink/db";
import type { QuestionResponse } from "@/lib/types";

// Save a single answer (partial saving)
export async function saveIndividualFormAnswer(
  supabase: SupabaseClient<Database>,
  submissionId: string,
  versionId: string,
  questionId: string,
  answerValue: QuestionResponse,
  isComplete: boolean,
  testmode: boolean,
) {
  const { error: submissionError } = await supabase
    .from("form_submissions")
    .upsert({
      submission_id: submissionId,
      form_version_id: versionId,
      status: isComplete ? "completed" : "in_progress",
      testmode,
    });

  if (submissionError) {
    console.error(
      "[save-answers] Error upserting form_submission record:",
      submissionError.message,
    );
    return;
  }

  const { error: saveError } = await supabase.from("form_answers").upsert(
    [
      {
        submission_id: submissionId,
        question_id: questionId,
        answer_value: answerValue as any,
      },
    ],
    { onConflict: "submission_id,question_id" },
  );

  if (saveError) {
    console.error(
      "[save-answers] Error saving response to DB:",
      saveError.message,
    );
  }
}

// Save all answers at once (bulk save)
export async function saveAllFormAnswers(
  supabase: SupabaseClient<Database>,
  submissionId: string,
  versionId: string,
  allResponses: Record<string, QuestionResponse>,
  isComplete: boolean,
  testmode: boolean,
) {
  const { error: submissionError } = await supabase
    .from("form_submissions")
    .upsert({
      submission_id: submissionId,
      form_version_id: versionId,
      status: isComplete ? "completed" : "in_progress",
      testmode,
    });

  if (submissionError) {
    console.error(
      "[save-answers] Error upserting form_submission record as completed:",
      submissionError.message,
    );
    return;
  }

  if (Object.keys(allResponses).length === 0) {
    return;
  }

  const answerUpserts = Object.entries(allResponses).map(
    ([question_id, answer_value]) => ({
      submission_id: submissionId,
      question_id,
      answer_value: answer_value as any,
    }),
  );

  const { error: saveError } = await supabase
    .from("form_answers")
    .upsert(answerUpserts, { onConflict: "submission_id,question_id" });

  if (saveError) {
    console.error(
      "[save-answers] Error bulk saving responses to DB:",
      saveError.message,
    );
  }
}

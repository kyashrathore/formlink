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
    console.error("Error upserting form_submission record:", submissionError);
    return;
  }

  const { error: saveError } = await supabase.from("form_answers").upsert([
    {
      submission_id: submissionId,
      question_id: questionId,
      answer_value: answerValue,
    },
  ]);

  if (saveError) {
    console.error("Error saving response to DB:", saveError);
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
      "Error upserting form_submission record as completed:",
      submissionError,
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
      answer_value,
    }),
  );

  const { error: saveError } = await supabase
    .from("form_answers")
    .upsert(answerUpserts);

  if (saveError) {
    console.error("Error bulk saving responses to DB:", saveError);
  }
}

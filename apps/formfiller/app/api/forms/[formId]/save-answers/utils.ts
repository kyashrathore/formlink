// Save a single answer (partial saving)
export async function saveIndividualFormAnswer(
    supabase: any,
    submissionId: string,
    versionId: string,
    questionId: string,
    answerValue: any,
    isComplete: boolean,
    testmode: boolean
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
  
    const { error: saveError } = await supabase
      .from("form_answers")
      .upsert([
        {
          submission_id: submissionId,
          question_id: questionId,
          answer_value: answerValue,
        },
      ]);
  
    if (saveError) {
      console.error("Error saving response to DB:", saveError);
    } else {
      console.log(`[API] Saved answer for question ${questionId} successfully.`);
    }
  }
  
// Save all answers at once (bulk save)
export async function saveAllFormAnswers(
  supabase: any,
  submissionId: string,
  versionId: string,
  allResponses: Record<string, any>,
  isComplete: boolean,
  testmode: boolean
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
      submissionError
    );
    return;
  }

  if (Object.keys(allResponses).length === 0) {
    console.log("[API] No responses to save, but submission record upserted.");
    return;
  }

  const answerUpserts = Object.entries(allResponses).map(
    ([question_id, answer_value]) => ({
      submission_id: submissionId,
      question_id,
      answer_value,
    })
  );

  const { error: saveError } = await supabase
    .from("form_answers")
    .upsert(answerUpserts);

  if (saveError) {
    console.error("Error bulk saving responses to DB:", saveError);
  } else {
    console.log("[API] All answers saved successfully.");
  }
}

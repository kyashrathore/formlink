-- Migration: Create get_filtered_submissions function for DB-level answer filtering and pagination
-- Version 8: Corrected submission_id type mismatch by explicitly casting to TEXT.

-- Suggested Indexes for performance:
-- CREATE INDEX idx_form_submissions_form_version_id ON form_submissions(form_version_id);
-- CREATE INDEX idx_form_submissions_status ON form_submissions(status); -- Assuming submission_status is an enum
-- CREATE INDEX idx_form_submissions_user_id ON form_submissions(user_id);
-- CREATE INDEX idx_form_submissions_created_at ON form_submissions(created_at);
-- CREATE INDEX idx_form_answers_submission_id ON form_answers(submission_id);
-- CREATE INDEX idx_form_answers_question_id ON form_answers(question_id);
-- If answer_value is JSONB, consider a GIN index:
-- CREATE INDEX idx_form_answers_answer_value_gin ON form_answers USING GIN (answer_value);
-- CREATE INDEX idx_form_answers_submission_question ON form_answers(submission_id, question_id);


CREATE OR REPLACE FUNCTION public.get_filtered_submissions(
  submission_filters JSONB,
  answer_filters JSONB,
  page INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  submission_id TEXT,
  form_version_id TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_submissions AS (
    -- This CTE selects submissions based on general submission-level filters.
    SELECT
        fs_inner.submission_id::TEXT, -- Explicitly cast submission_id to TEXT
        fs_inner.form_version_id::TEXT,
        fs_inner.user_id::TEXT,
        fs_inner.created_at,
        fs_inner.completed_at,
        fs_inner.status::TEXT
    FROM form_submissions fs_inner
    WHERE
      (submission_filters->>'form_version_id' IS NULL OR fs_inner.form_version_id = (submission_filters->>'form_version_id')::uuid)
      AND (submission_filters->>'status' IS NULL OR fs_inner.status = (submission_filters->>'status')::public.submission_status) -- Adjust schema if submission_status is not in public
      AND (submission_filters->>'user_id' IS NULL OR fs_inner.user_id = (submission_filters->>'user_id')::uuid)
      AND (submission_filters->>'created_at' IS NULL OR fs_inner.created_at >= (submission_filters->>'created_at')::timestamptz)
  ),
  relevant_filter_data AS (
    -- Pre-processes answer_filters to get question_id and their filter_criteria (JSONB values).
    SELECT key AS question_id, value AS filter_criteria
    FROM jsonb_each(answer_filters) -- SRF used correctly in FROM clause
    WHERE answer_filters IS NOT NULL AND answer_filters != '{}'::jsonb
  ),
  answer_conditions AS (
    -- Identifies answers matching criteria from relevant_filter_data.
    SELECT DISTINCT -- DISTINCT because LATERAL join for arrays might create duplicates for (submission_id, question_id)
      a.submission_id,
      a.question_id
    FROM
      form_answers a
      JOIN relevant_filter_data rfd ON a.question_id = rfd.question_id
      LEFT JOIN LATERAL jsonb_array_elements( -- SRF used correctly in FROM with LATERAL
          CASE
              WHEN jsonb_typeof(rfd.filter_criteria) = 'array' THEN rfd.filter_criteria
              ELSE NULL -- jsonb_array_elements handles NULL by returning no rows
          END
      ) AS arr_elem(val) ON TRUE
    WHERE
      (
        (jsonb_typeof(rfd.filter_criteria) = 'array' AND a.answer_value = arr_elem.val) OR
        (jsonb_typeof(rfd.filter_criteria) = 'string' AND a.answer_value = rfd.filter_criteria) OR
        (jsonb_typeof(rfd.filter_criteria) IN ('number', 'boolean') AND a.answer_value = rfd.filter_criteria) OR
        (jsonb_typeof(rfd.filter_criteria) = 'null' AND (a.answer_value IS NULL OR a.answer_value = 'null'::jsonb))
      )
  ),
  submissions_with_answer_counts AS (
    -- Counts distinct matched questions per submission.
    SELECT
      fs.submission_id,
      fs.form_version_id,
      fs.user_id,
      fs.created_at,
      fs.completed_at,
      fs.status,
      COUNT(DISTINCT ac.question_id) AS matched_question_count
    FROM filtered_submissions fs
    LEFT JOIN answer_conditions ac ON fs.submission_id::uuid = ac.submission_id -- Cast fs.submission_id back to UUID for joining if ac.submission_id is UUID
    GROUP BY
      fs.submission_id, fs.form_version_id, fs.user_id, fs.created_at, fs.completed_at, fs.status
  ),
  answer_filter_stats AS (
    -- Pre-calculates the total number of keys in answer_filters.
    SELECT
      CASE
        WHEN answer_filters IS NOT NULL AND answer_filters != '{}'::jsonb
        THEN (SELECT count(*) FROM jsonb_object_keys(answer_filters))::integer -- Count keys directly and cast to integer
        ELSE 0
      END AS total_filter_keys
  )
  -- Final selection, joining with pre-calculated filter stats, and applying pagination.
  SELECT
    swac.submission_id,
    swac.form_version_id,
    swac.user_id,
    swac.created_at,
    swac.completed_at,
    swac.status
  FROM submissions_with_answer_counts swac
  CROSS JOIN answer_filter_stats afs -- afs will always have one row
  WHERE
    (
      afs.total_filter_keys = 0 OR -- True if no answer filters are active (null, empty, or explicitly 0 keys)
      swac.matched_question_count = afs.total_filter_keys -- True if all specified answer filters are matched
    )
  ORDER BY swac.created_at DESC
  LIMIT page_size OFFSET (page - 1) * page_size;
END;
$$ LANGUAGE plpgsql;


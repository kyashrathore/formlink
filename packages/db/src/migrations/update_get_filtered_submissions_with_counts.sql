-- Migration: Update get_filtered_submissions function to include counts
-- Version 11: Added total and filtered counts to support UI requirements

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_filtered_submissions(jsonb,jsonb,integer,integer);

-- Create the updated function that returns counts along with paginated data
CREATE OR REPLACE FUNCTION public.get_filtered_submissions(
  submission_filters JSONB,
  answer_filters JSONB,
  page INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  data JSONB,
  total_count BIGINT,
  total_completed_count BIGINT,
  total_in_progress_count BIGINT,
  total_filtered_count BIGINT,
  completed_count BIGINT,
  in_progress_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_submissions_base AS (
    -- This CTE selects submissions based on general submission-level filters.
    -- It selects the original UUIDs and other necessary fields for internal use.
    SELECT
        fs_inner.submission_id AS original_submission_id,
        fs_inner.form_version_id,
        fs_inner.user_id,
        fs_inner.created_at,
        fs_inner.completed_at,
        fs_inner.status,
        fs_inner.testmode
    FROM form_submissions fs_inner
    WHERE
      (submission_filters->>'form_version_id' IS NULL OR fs_inner.form_version_id = (submission_filters->>'form_version_id')::uuid)
      AND (submission_filters->>'status' IS NULL OR fs_inner.status = (submission_filters->>'status')::public.submission_status)
      AND (submission_filters->>'user_id' IS NULL OR fs_inner.user_id = (submission_filters->>'user_id')::uuid)
      AND (submission_filters->>'created_at' IS NULL OR fs_inner.created_at >= (submission_filters->>'created_at')::timestamptz)
      AND (submission_filters->>'testmode' IS NULL OR fs_inner.testmode = (submission_filters->>'testmode')::boolean)
  ),
  relevant_filter_data AS (
    -- Pre-processes answer_filters to get question_id and their filter_criteria (JSONB values).
    SELECT key AS question_id, value AS filter_criteria
    FROM jsonb_each(answer_filters)
    WHERE answer_filters IS NOT NULL AND answer_filters != '{}'::jsonb
  ),
  answer_conditions AS (
    -- Identifies submissions and question_ids that match answer filter criteria.
    SELECT DISTINCT
      a.submission_id,
      a.question_id
    FROM
      form_answers a
      JOIN relevant_filter_data rfd ON a.question_id = rfd.question_id
      LEFT JOIN LATERAL jsonb_array_elements(
          CASE
              WHEN jsonb_typeof(rfd.filter_criteria) = 'array' THEN rfd.filter_criteria
              ELSE NULL
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
  submissions_meeting_filter_criteria AS (
    -- Counts distinct matched questions per submission and filters them.
    SELECT
      fsb.original_submission_id,
      fsb.form_version_id,
      fsb.user_id,
      fsb.created_at,
      fsb.completed_at,
      fsb.status,
      fsb.testmode,
      COUNT(DISTINCT ac.question_id) AS matched_question_count
    FROM filtered_submissions_base fsb
    LEFT JOIN answer_conditions ac ON fsb.original_submission_id = ac.submission_id
    GROUP BY
      fsb.original_submission_id, fsb.form_version_id, fsb.user_id, fsb.created_at, fsb.completed_at, fsb.status, fsb.testmode
  ),
  answer_filter_stats AS (
    -- Pre-calculates the total number of keys in answer_filters.
    SELECT
      CASE
        WHEN answer_filters IS NOT NULL AND answer_filters != '{}'::jsonb
        THEN (SELECT count(*) FROM jsonb_object_keys(answer_filters))::integer
        ELSE 0
      END AS total_filter_keys
  ),
  qualified_submissions AS (
    -- Selects submissions that pass all filters.
    SELECT
      smfc.original_submission_id,
      smfc.form_version_id,
      smfc.user_id,
      smfc.created_at,
      smfc.completed_at,
      smfc.status,
      smfc.testmode
    FROM submissions_meeting_filter_criteria smfc
    CROSS JOIN answer_filter_stats afs
    WHERE
      (
        afs.total_filter_keys = 0 OR
        smfc.matched_question_count = afs.total_filter_keys
      )
  ),
  aggregated_answers AS (
    -- Aggregates all answers for the qualified submissions.
    SELECT
      fa.submission_id,
      jsonb_object_agg(fa.question_id, fa.answer_value) as submission_answers
    FROM form_answers fa
    WHERE fa.submission_id IN (SELECT qs.original_submission_id FROM qualified_submissions qs)
    GROUP BY fa.submission_id
  ),
  paginated_results AS (
    -- Get paginated results with aggregated answers
    SELECT
      qs.original_submission_id::TEXT AS submission_id,
      qs.form_version_id::TEXT AS form_version_id,
      qs.user_id::TEXT AS user_id,
      qs.created_at,
      qs.completed_at,
      qs.status::TEXT AS status,
      qs.testmode,
      COALESCE(aa.submission_answers, '{}'::jsonb) AS answers
    FROM qualified_submissions qs
    LEFT JOIN aggregated_answers aa ON qs.original_submission_id = aa.submission_id
    ORDER BY qs.created_at DESC
    LIMIT page_size OFFSET (page - 1) * page_size
  ),
  counts AS (
    -- Calculate counts from qualified submissions (filtered)
    SELECT
      COUNT(*) AS total_filtered,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress
    FROM qualified_submissions
  ),
  total_counts AS (
    -- Calculate total counts for the form (ignoring all filters except form_version_id)
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS total_in_progress
    FROM form_submissions
    WHERE form_version_id = (submission_filters->>'form_version_id')::uuid
  )
  -- Return a single row with data array and counts
  SELECT
    COALESCE(
      (SELECT jsonb_agg(row_to_json(pr.*)) FROM paginated_results pr),
      '[]'::jsonb
    ) AS data,
    tc.total AS total_count,
    tc.total_completed AS total_completed_count,
    tc.total_in_progress AS total_in_progress_count,
    c.total_filtered AS total_filtered_count,
    c.completed AS completed_count,
    c.in_progress AS in_progress_count
  FROM counts c
  CROSS JOIN total_counts tc;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_filtered_submissions(jsonb,jsonb,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_submissions(jsonb,jsonb,integer,integer) TO service_role;

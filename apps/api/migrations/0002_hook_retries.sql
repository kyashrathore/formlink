-- afterSubmit / onStatusChange runs that failed, retried with backoff by the 5-minute cron.
CREATE TABLE hook_retries (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  extra TEXT NOT NULL DEFAULT '{}',
  attempt INTEGER NOT NULL,
  next_at INTEGER NOT NULL,
  last_error TEXT
);
CREATE INDEX hook_retries_due ON hook_retries(next_at);

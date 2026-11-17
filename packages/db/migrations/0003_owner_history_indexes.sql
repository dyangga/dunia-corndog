CREATE INDEX expenses_branch_time ON expenses(branch_id,created_at DESC,id DESC);
CREATE INDEX expenses_reversal_time ON expenses(branch_id,reversed_at DESC,id DESC) WHERE reversed_at IS NOT NULL;
CREATE INDEX shifts_branch_time ON shifts(branch_id,opened_at DESC,id DESC);

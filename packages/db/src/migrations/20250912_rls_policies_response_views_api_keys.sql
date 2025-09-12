-- Enable RLS and add policies for new tables

ALTER TABLE public.response_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY response_views_select_self ON public.response_views
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY response_views_insert_self ON public.response_views
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY response_views_update_self ON public.response_views
    FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY response_views_delete_self ON public.response_views
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.formlink_api_keys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY api_keys_select_self ON public.formlink_api_keys
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_keys_insert_self ON public.formlink_api_keys
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_keys_update_self ON public.formlink_api_keys
    FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_keys_delete_self ON public.formlink_api_keys
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.response_actions_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY actions_select_self ON public.response_actions_log
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY actions_insert_self ON public.response_actions_log
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


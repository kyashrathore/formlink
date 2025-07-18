-- Premium Subscriptions Migration
-- Creates tables for managing user subscriptions and premium features

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  external_customer_id TEXT, -- Polar.sh customer ID
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'pro')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Simple audit log for subscription changes
CREATE TABLE IF NOT EXISTS subscription_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'canceled'
  old_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_logs_user_id ON subscription_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_logs_created_at ON subscription_logs(created_at);

-- RLS policies for user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own subscription
CREATE POLICY user_subscriptions_select_own ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Only service role can insert/update subscriptions (via webhooks)
CREATE POLICY user_subscriptions_insert_service ON user_subscriptions
  FOR INSERT WITH CHECK (false); -- Only service role can insert

CREATE POLICY user_subscriptions_update_service ON user_subscriptions
  FOR UPDATE USING (false); -- Only service role can update

-- RLS policies for subscription_logs
ALTER TABLE subscription_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own logs
CREATE POLICY subscription_logs_select_own ON subscription_logs
  FOR SELECT USING (user_id = auth.uid());

-- Only service role can insert logs
CREATE POLICY subscription_logs_insert_service ON subscription_logs
  FOR INSERT WITH CHECK (false); -- Only service role can insert

-- Grant permissions to service role for webhook operations
GRANT ALL ON user_subscriptions TO service_role;
GRANT ALL ON subscription_logs TO service_role;

-- Grant read permissions to authenticated users
GRANT SELECT ON user_subscriptions TO authenticated;
GRANT SELECT ON subscription_logs TO authenticated;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment daily message count for AI usage tracking
CREATE OR REPLACE FUNCTION increment_daily_message_count(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users 
  SET daily_message_count = daily_message_count + 1,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_daily_message_count(UUID) TO authenticated;

-- Comment the tables
COMMENT ON TABLE user_subscriptions IS 'Stores user subscription information linked to Polar.sh';
COMMENT ON TABLE subscription_logs IS 'Audit log for subscription status changes';
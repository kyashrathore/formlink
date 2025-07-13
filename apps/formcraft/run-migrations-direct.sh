#\!/bin/bash

# Get the database URL from your Supabase project
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_NAME="postgres"
DB_USER="postgres.fvivnkllowakgvkpgrkz"
DB_PORT="5432"

echo "You'll need your database password from:"
echo "https://supabase.com/dashboard/project/fvivnkllowakgvkpgrkz/settings/database"
echo ""

# Run the first migration
echo "Applying users table RLS fixes..."
psql "postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME" \
  -f supabase/migrations/20250624_fix_anonymous_users_rls.sql

# Run the second migration
echo "Applying other tables RLS fixes..."
psql "postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME" \
  -f supabase/migrations/20250624_anonymous_users_complete_fix.sql

echo "Migrations completed\!"

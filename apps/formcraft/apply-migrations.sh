#\!/bin/bash

# Apply RLS migrations to production database

echo "Applying RLS migrations for anonymous users..."

# First, let's check if we have the correct project linked
echo "Checking linked project..."
npx supabase projects list

echo ""
echo "Running migrations..."
echo "Note: You'll need to enter your database password when prompted"
echo ""

# Apply the migrations using db push
npx supabase db push --linked

# Alternative: If the above doesn't work, you can use the direct SQL approach
# You'll need to set your database password as an environment variable first
# export PGPASSWORD='your-database-password'
# Then run:
# npx supabase db remote commit --linked

echo ""
echo "Migrations completed\!"

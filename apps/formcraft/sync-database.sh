#!/bin/bash

echo "=== Syncing Local Supabase with Production ==="
echo ""
echo "This script will help you sync your local database with production."
echo ""

# Step 1: Remove local migrations
echo "Step 1: Removing local migrations..."
rm -rf supabase/migrations/*
echo "✓ Local migrations removed"
echo ""

# Step 2: Pull from production
echo "Step 2: Pulling schema from production..."
echo "You will need to enter your database password."
echo "Find it at: https://supabase.com/dashboard/project/fvivnkllowakgvkpgrkz/settings/database"
echo ""
npx supabase db pull

# Step 3: Reset local database
echo ""
echo "Step 3: Resetting local database with production schema..."
npx supabase db reset

echo ""
echo "=== Sync Complete! ==="
echo "Your local database now matches production."
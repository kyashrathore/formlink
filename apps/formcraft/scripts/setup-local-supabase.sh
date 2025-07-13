#!/bin/bash

echo "🚀 Setting up local Supabase environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker is running"

# Start Supabase
echo "📦 Starting Supabase services..."
pnpm supabase:start

# Wait for Supabase to be ready
echo "⏳ Waiting for Supabase to be ready..."
sleep 10

# Apply migrations
echo "🔄 Applying database migrations..."
npx supabase db push

# Note: Storage bucket creation script was removed
echo "⚠️  Storage bucket creation script removed - configure manually if needed"

echo "✅ Local Supabase setup complete!"
echo ""
echo "📋 Important URLs:"
echo "   - App: http://localhost:3000"
echo "   - Studio: http://localhost:54323" 
echo "   - API: http://localhost:54321"
echo ""
echo "⚠️  Always use http://localhost:3000 (not 127.0.0.1) for authentication to work!"
echo ""
echo "🎯 Next steps:"
echo "   1. Run 'pnpm dev' in another terminal"
echo "   2. Access the app at http://localhost:3000"
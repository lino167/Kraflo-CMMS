#!/bin/bash

# Kraflo CMMS - Supabase Setup Script
# This script automates the initialization and deployment of the Supabase backend.

echo "🚀 Starting Kraflo Supabase Setup..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "❌ Supabase CLI not found. Please install it: https://supabase.com/docs/guides/cli"
    exit
fi

# 1. Initialize Supabase (if not already)
if [ ! -d "supabase" ]; then
    echo "📦 Initializing Supabase..."
    supabase init
else
    echo "✅ Supabase directory already exists."
fi

# 2. Login (optional, but usually needed for remote projects)
# echo "🔑 Please login to Supabase..."
# supabase login

# 3. Link project (Interactive)
echo "🔗 Linking your Supabase project..."
echo "Hint: You can find your Project Ref in the Supabase Dashboard settings."
supabase link

# 4. Push Migrations
echo "🗄️ Pushing database migrations..."
supabase db push

# 5. Deploy Edge Functions
echo "⚡ Deploying Edge Functions..."
# We deploy all functions found in the supabase/functions directory
for dir in supabase/functions/*/ ; do
    function_name=$(basename "$dir")
    if [ "$function_name" != "_shared" ]; then
        echo "  -> Deploying $function_name..."
        supabase functions deploy "$function_name" --no-verify-jwt # Defaulting to config.toml settings
    fi
done

# 6. Reminder for Environment Variables
echo ""
echo "🎉 Backend deployment complete!"
echo "⚠️  IMPORTANT: Remember to set your secrets in the Supabase Dashboard for the following functions:"
echo " - assistente-ia (LOVABLE_API_KEY, etc.)"
echo " - telegram-webhook (TELEGRAM_BOT_TOKEN)"
echo ""
echo "Check docs/supabase-automacoes.md for the full list of required variables."
echo "Happy hacking! 🛠️"

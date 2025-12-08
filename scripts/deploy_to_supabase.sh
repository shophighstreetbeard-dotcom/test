#!/usr/bin/env bash
set -euo pipefail

# Deploy helper for Supabase Edge Functions in this repo.
# Usage: run this on your machine (NOT by pasting secrets into chat).
# Prerequisites:
#  - Install supabase CLI: https://supabase.com/docs/guides/cli
#  - You must be logged in locally: `supabase login` (opens browser)
#  - Node / npm available for any local builds
#
# This script:
#  1. Prompts for your Supabase project ref
#  2. Deploys the functions: takealot-webhook, sync-takealot-products, update-takealot-prices
#  3. Sets secrets using `supabase secrets set` (you enter values locally, they are NOT stored in this repo)
#  4. Triggers a test invocation of `sync-takealot-products` (optional)

echo "Supabase Edge Function deploy helper"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli"
  exit 1
fi

read -rp "Enter your Supabase project ref (e.g. abcdefghijklmnopqrs): " PROJECT_REF

# Link the current directory to the project ref
echo "Linking to project $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

# Prompt for secrets (entered locally and not saved to disk by this script)
read -rp "Enter TAKEALOT_API_KEY (leave empty to skip): " TAKEALOT_API_KEY
read -rp "Enter TAKEALOT_WEBHOOK_SECRET (leave empty to skip): " TAKEALOT_WEBHOOK_SECRET
read -rp "Enter SERVICE_ROLE_KEY (Supabase service role - leave empty to skip): " SERVICE_ROLE_KEY
read -rp "Enter EDGE_FUNCTION_API_KEY (optional, leave empty to skip): " EDGE_FUNCTION_API_KEY

# Deploy each function
for fn in takealot-webhook sync-takealot-products update-takealot-prices; do
  echo "Deploying function: $fn"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

# Set secrets via supabase CLI if available
# Note: `supabase secrets` encrypts values and makes them available to functions.
if command -v supabase >/dev/null 2>&1; then
  set +u
  if [ -n "$TAKEALOT_API_KEY" ]; then
    echo "Setting TAKEALOT_API_KEY secret..."
    supabase secrets set --project-ref "$PROJECT_REF" TAKEALOT_API_KEY="$TAKEALOT_API_KEY"
  fi

  if [ -n "$TAKEALOT_WEBHOOK_SECRET" ]; then
    echo "Setting TAKEALOT_WEBHOOK_SECRET secret..."
    supabase secrets set --project-ref "$PROJECT_REF" TAKEALOT_WEBHOOK_SECRET="$TAKEALOT_WEBHOOK_SECRET"
  fi

  if [ -n "$SERVICE_ROLE_KEY" ]; then
    echo "Setting SERVICE_ROLE_KEY secret..."
    supabase secrets set --project-ref "$PROJECT_REF" SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
  fi

  if [ -n "$EDGE_FUNCTION_API_KEY" ]; then
    echo "Setting EDGE_FUNCTION_API_KEY secret..."
    supabase secrets set --project-ref "$PROJECT_REF" EDGE_FUNCTION_API_KEY="$EDGE_FUNCTION_API_KEY"
  fi
  set -u
fi

echo "Deployment complete. Function URLs:" 

echo "takealot-webhook: https://${PROJECT_REF}.functions.supabase.co/takealot-webhook"
echo "sync-takealot-products: https://${PROJECT_REF}.functions.supabase.co/sync-takealot-products"
echo "update-takealot-prices: https://${PROJECT_REF}.functions.supabase.co/update-takealot-prices"

read -rp "Do you want me to trigger a test sync now? (y/N) " TRIGGER
if [[ "$TRIGGER" =~ ^[Yy]$ ]]; then
  echo "Triggering test sync for user_id 'test-user' (will POST to sync endpoint)"
  curl -v -X POST "https://${PROJECT_REF}.functions.supabase.co/sync-takealot-products" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test-user"}' || true
fi

echo "Done. Check the Supabase dashboard for logs and function activity."

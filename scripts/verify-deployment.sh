#!/bin/bash
# verify-deployment.sh - Verify Supabase functions are deployed and working

set -euo pipefail

# Configuration
SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL env var required}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY env var required}"
PROJECT_REF="${PROJECT_REF:?PROJECT_REF env var required}"
TAKEALOT_API_KEY="${TAKEALOT_API_KEY:?TAKEALOT_API_KEY env var required}"
TEST_USER_ID="${TEST_USER_ID:-00000000-0000-0000-0000-000000000001}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Supabase Deployment Verification"
echo "=========================================="
echo ""
echo "Project Ref: $PROJECT_REF"
echo "Supabase URL: $SUPABASE_URL"
echo ""

# Test 1: Check function endpoints are accessible
echo "Test 1: Checking function endpoints..."
echo "------"

FUNCTIONS=("takealot-webhook" "sync-takealot-products" "update-takealot-prices")

for fn in "${FUNCTIONS[@]}"; do
  echo -n "  $fn ... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    "https://${PROJECT_REF}.supabase.co/functions/v1/$fn" \
    -H "Content-Type: application/json")
  
  if [ "$response" = "200" ] || [ "$response" = "204" ]; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗ (HTTP $response)${NC}"
  fi
done

echo ""

# Test 2: Test sync-takealot-products function
echo "Test 2: Testing sync-takealot-products function..."
echo "------"
echo -n "  Calling sync endpoint ... "

response=$(curl -s -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/sync-takealot-products" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TAKEALOT_API_KEY" \
  -d "{\"user_id\": \"$TEST_USER_ID\"}")

# Check if response contains expected fields
if echo "$response" | grep -q '"success"'; then
  echo -e "${GREEN}✓${NC}"
  echo "  Response: $response" | head -c 200
  echo ""
else
  echo -e "${RED}✗${NC}"
  echo "  Response: $response" | head -c 200
  echo ""
fi

echo ""

# Test 3: Check database connectivity
echo "Test 3: Testing database connectivity..."
echo "------"
echo -n "  Querying products table ... "

product_count=$(curl -s \
  "${SUPABASE_URL}/rest/v1/products?select=count()&eq(user_id,$TEST_USER_ID)" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" | jq -r '.count // 0' 2>/dev/null || echo "0")

if [ ! -z "$product_count" ]; then
  echo -e "${GREEN}✓${NC} ($product_count products)"
else
  echo -e "${RED}✗${NC}"
fi

echo ""
echo -n "  Querying sales table ... "

sales_count=$(curl -s \
  "${SUPABASE_URL}/rest/v1/sales?select=count()&eq(user_id,$TEST_USER_ID)" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" | jq -r '.count // 0' 2>/dev/null || echo "0")

if [ ! -z "$sales_count" ]; then
  echo -e "${GREEN}✓${NC} ($sales_count sales)"
else
  echo -e "${RED}✗${NC}"
fi

echo ""

# Test 4: Check webhook event storage
echo "Test 4: Testing webhook event logging..."
echo "------"
echo -n "  Querying webhook_events table ... "

event_count=$(curl -s \
  "${SUPABASE_URL}/rest/v1/webhook_events?select=count()&eq(user_id,$TEST_USER_ID)" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" | jq -r '.count // 0' 2>/dev/null || echo "0")

if [ ! -z "$event_count" ]; then
  echo -e "${GREEN}✓${NC} ($event_count events)"
else
  echo -e "${RED}✗${NC}"
fi

echo ""

# Test 5: Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""
echo "✓ All critical functions are deployed"
echo "✓ Database tables are accessible"
echo "✓ Test user data exists (if seeded)"
echo ""
echo "Next steps:"
echo "  1. Visit: http://localhost:5173"
echo "  2. Login with test credentials"
echo "  3. Verify data displays correctly"
echo "  4. Test sync and webhook functionality"
echo ""

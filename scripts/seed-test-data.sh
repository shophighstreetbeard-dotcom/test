#!/bin/bash
# test-data-seed.sh - Generate test data for local testing

set -euo pipefail

# Configuration
SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL env var required}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY env var required}"
TEST_USER_ID="${TEST_USER_ID:-00000000-0000-0000-0000-000000000001}"

echo "Seeding test data for user: $TEST_USER_ID"

# Helper function to make API requests
api_call() {
  local method=$1
  local path=$2
  local data=$3
  
  curl -s -X "$method" \
    "${SUPABASE_URL}/rest/v1/$path" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$data"
}

# Insert test products
echo "Inserting test products..."

api_call POST "products" '{
  "user_id": "'$TEST_USER_ID'",
  "sku": "TEST-001",
  "title": "Test Product 1 - Electronics",
  "current_price": 299.99,
  "min_price": 250.00,
  "max_price": 399.99,
  "cost_price": 150.00,
  "stock_quantity": 25,
  "takealot_offer_id": "offer-test-001",
  "buy_box_status": "won",
  "is_active": true,
  "image_url": "https://via.placeholder.com/300?text=Product+1"
}'

api_call POST "products" '{
  "user_id": "'$TEST_USER_ID'",
  "sku": "TEST-002",
  "title": "Test Product 2 - Home & Garden",
  "current_price": 149.99,
  "min_price": 120.00,
  "max_price": 199.99,
  "cost_price": 75.00,
  "stock_quantity": 50,
  "takealot_offer_id": "offer-test-002",
  "buy_box_status": "lost",
  "is_active": true,
  "image_url": "https://via.placeholder.com/300?text=Product+2"
}'

api_call POST "products" '{
  "user_id": "'$TEST_USER_ID'",
  "sku": "TEST-003",
  "title": "Test Product 3 - Fashion",
  "current_price": 89.99,
  "min_price": 70.00,
  "max_price": 129.99,
  "cost_price": 40.00,
  "stock_quantity": 100,
  "takealot_offer_id": "offer-test-003",
  "buy_box_status": "unknown",
  "is_active": true,
  "image_url": "https://via.placeholder.com/300?text=Product+3"
}'

# Insert test sales
echo "Inserting test sales..."

# Get first product ID for sales
PRODUCT_ID=$(api_call GET "products?select=id&limit=1&user_id=eq.$TEST_USER_ID" "" | jq -r '.[0].id')

api_call POST "sales" '{
  "user_id": "'$TEST_USER_ID'",
  "product_id": "'$PRODUCT_ID'",
  "order_id": "ORDER-001",
  "quantity": 2,
  "sale_price": 299.99,
  "sold_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
}'

api_call POST "sales" '{
  "user_id": "'$TEST_USER_ID'",
  "product_id": "'$PRODUCT_ID'",
  "order_id": "ORDER-002",
  "quantity": 1,
  "sale_price": 299.99,
  "sold_at": "'$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)'"
}'

api_call POST "sales" '{
  "user_id": "'$TEST_USER_ID'",
  "product_id": "'$PRODUCT_ID'",
  "order_id": "ORDER-003",
  "quantity": 3,
  "sale_price": 299.99,
  "sold_at": "'$(date -u -d '2 days ago' +%Y-%m-%dT%H:%M:%SZ)'"
}'

# Insert test webhook events
echo "Inserting test webhook events..."

api_call POST "webhook_events" '{
  "user_id": "'$TEST_USER_ID'",
  "event_type": "sale.status.changed",
  "payload": {
    "event_type": "sale.status.changed",
    "order_id": 12345,
    "sku": "TEST-001",
    "status": "completed"
  },
  "processed": true
}'

api_call POST "webhook_events" '{
  "user_id": "'$TEST_USER_ID'",
  "event_type": "leadtime_order_item",
  "payload": {
    "event_type": "leadtime_order_item",
    "order_item_id": 67890,
    "offer_id": "offer-test-001",
    "quantity": 5,
    "warehouse": "JNB"
  },
  "processed": true
}'

echo "✓ Test data seeded successfully!"
echo ""
echo "Test data summary:"
echo "  - 3 products inserted"
echo "  - 3 sales records created"
echo "  - 2 webhook events logged"
echo ""
echo "User ID: $TEST_USER_ID"
echo ""
echo "Access the app at: http://localhost:5173"

#!/usr/bin/env bash
set -euo pipefail

# Send a test webhook to the local Edge Function (assumes function running on http://localhost:8000)
ENDPOINT=${1:-http://localhost:8000}

cat <<JSON | curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @-
{
  "event_type": "offer.update",
  "offer_id": "123",
  "sku": "SKU123",
  "price": 99,
  "stock": 10,
  "buy_box_winner": false,
  "timestamp": "2025-12-07T00:00:00Z",
  "user_id": "test-user"
}
JSON

echo

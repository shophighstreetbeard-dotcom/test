# Testing Guide - Pricer Pro (Takealot Repricer)

## Overview
This document outlines the comprehensive testing procedures for the Pricer Pro application, including frontend UI/UX, backend API integration, webhook handling, and data synchronization.

## Test Environment Setup

### Prerequisites
- Node.js (v18+) installed
- Bun or npm for package management
- Supabase CLI installed
- Access to Takealot Seller API (test credentials)
- GitHub Actions access for deployment verification

### Local Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in browser
```

## Frontend Testing

### 1. Authentication & Authorization
- [ ] Sign up with new email
- [ ] Login with valid credentials
- [ ] Logout functionality works
- [ ] Protected routes redirect to login
- [ ] Session persists on page reload
- [ ] Invalid credentials show error message

### 2. Dashboard Page
- [ ] Load time < 2 seconds
- [ ] Stats cards display correct data
  - [ ] Product count updates after sync
  - [ ] Buy box win rate calculates correctly
  - [ ] Revenue data from sales table
- [ ] Charts render without errors
- [ ] Navigation links work

### 3. Products Page
- [ ] **Inventory Tab:**
  - [ ] Grid view displays product images
  - [ ] Missing images show placeholder
  - [ ] Product cards show SKU, title, price, stock
  - [ ] Buy box badge displays correctly
  - [ ] Search filters by SKU and title
  - [ ] Add product dialog opens/closes
  - [ ] Form validation works (required fields, number validation)
  - [ ] Add product creates entry in database
  - [ ] Delete product removes from list with confirmation
  - [ ] Sync from Takealot button triggers sync function
  - [ ] Sync shows success message with count

- [ ] **Sales Tab:**
  - [ ] Sales list shows all transactions
  - [ ] Columns: Order ID, Product, SKU, Qty, Price, Total, Date
  - [ ] Date format is correct (ZA locale)
  - [ ] Empty state message when no sales
  - [ ] Total calculation correct (price × qty)

### 4. Analytics Page
- [ ] Stats cards load with data
- [ ] Revenue area chart displays
- [ ] Buy box performance chart displays
- [ ] Category pie chart renders
- [ ] All charts are responsive
- [ ] No console errors

### 5. Settings Page
- [ ] Profile fields populate from database
- [ ] Save changes updates database
- [ ] Takealot API key field accepts input
- [ ] Webhook URL copies to clipboard
- [ ] Setup instructions are visible
- [ ] Notification preferences functional

### 6. Repricing Page
- [ ] Lists products needing repricing
- [ ] AI recommendations display
- [ ] Price update simulation works
- [ ] Confirm repricing modal works
- [ ] Success message after update

### 7. Competitors Page
- [ ] Shows competitor pricing data
- [ ] Competitor count updates
- [ ] Price comparison chart displays
- [ ] Filters work

## Backend API Testing

### 1. Product Synchronization (`sync-takealot-products`)
```bash
# Test sync function
curl -X POST http://localhost:5173/functions/v1/sync-takealot-products \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000001"}'
```

Tests:
- [ ] Fetches all products from Takealot API
- [ ] Handles pagination (100 products per page)
- [ ] Creates new products in database
- [ ] Updates existing products with latest data
- [ ] Calculates stock from leadtime_stock array
- [ ] Logs price history on price changes
- [ ] Returns success with synced count
- [ ] Handles API errors gracefully (with retries)
- [ ] Retries on transient errors (429, 502, 503, 504)

### 2. Webhook Handler (`takealot-webhook`)
```bash
# Test webhook signature
TIMESTAMP=$(date +%s)000
SIGNATURE=$(echo -n "$TIMESTAMP" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

curl -X POST http://localhost:5173/functions/v1/takealot-webhook \
  -H "Content-Type: application/json" \
  -H "X-Takealot-Signature: $SIGNATURE" \
  -H "X-Takealot-Timestamp: $TIMESTAMP" \
  -d '{
    "event_type": "sale.status.changed",
    "user_id": "00000000-0000-0000-0000-000000000001",
    "order_id": 12345,
    "items": [{"offer_id": "xyz", "quantity": 1, "selling_price": 99.99}]
  }'
```

Tests:
- [ ] Signature verification rejects invalid signatures
- [ ] Rate limiting blocks excessive requests
- [ ] Stores webhook event in database
- [ ] Processes leadtime order items
  - [ ] Inserts record in leadtime_orders
  - [ ] Decrements per-warehouse stock
  - [ ] Updates aggregate stock_quantity
  - [ ] Marks event as processed
- [ ] Processes sale events
  - [ ] Creates sales table entry
  - [ ] Decrements product stock
  - [ ] Updates last_synced_at
- [ ] Processes offer events (created/updated)
  - [ ] Upserts product by SKU or offer_id
  - [ ] Updates image_url
  - [ ] Updates title and price

### 3. Price Update Function (`update-takealot-prices`)
```bash
curl -X POST http://localhost:5173/functions/v1/update-takealot-prices \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"product_id": "product-uuid", "new_price": 129.99}
    ]
  }'
```

Tests:
- [ ] Updates price on Takealot API
- [ ] Logs price change to price_history
- [ ] Returns success for each update
- [ ] Handles API errors
- [ ] Retries on transient errors

### 4. AI Repricer (`ai-repricer`)
Tests:
- [ ] Fetches products from database
- [ ] Calls Gemini API for recommendations
- [ ] Respects min/max price constraints
- [ ] Skips products with unchanged prices
- [ ] Updates Takealot prices
- [ ] Returns repricing results

## Database Testing

### 1. Schema Validation
- [ ] `profiles` table has all columns
- [ ] `products` table includes `leadtime_stock_details`
- [ ] `sales` table exists with correct schema
- [ ] `webhook_events` table stores events
- [ ] `leadtime_orders` table created
- [ ] Indexes exist for performance

### 2. Data Integrity
- [ ] Foreign key constraints enforced
- [ ] Cascade deletes work correctly
- [ ] User data isolation (user_id in all queries)
- [ ] Stock quantities never go negative
- [ ] Timestamps update correctly

### 3. Test Data
```sql
-- Insert test product
INSERT INTO products (user_id, sku, title, current_price, stock_quantity, takealot_offer_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'TEST-SKU-001',
  'Test Product',
  99.99,
  50,
  'offer-12345'
);

-- Insert test sale
INSERT INTO sales (user_id, product_id, order_id, quantity, sale_price, sold_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'product-uuid',
  'ORDER-12345',
  1,
  99.99,
  now()
);
```

## Integration Testing

### End-to-End Workflow
1. **Product Sync**
   - [ ] Sync Takealot products
   - [ ] Verify count in database
   - [ ] Check image URLs populated
   - [ ] Verify prices correct

2. **Leadtime Order Processing**
   - [ ] Send leadtime order webhook
   - [ ] Verify stock decremented
   - [ ] Check leadtime_orders table
   - [ ] Confirm event marked processed

3. **Sale Processing**
   - [ ] Send sale status webhook
   - [ ] Verify stock decremented
   - [ ] Check sales table entry
   - [ ] Verify amount calculated correctly

4. **Repricing Workflow**
   - [ ] Run AI repricer
   - [ ] Verify prices updated on Takealot
   - [ ] Check price_history logged
   - [ ] Confirm UI shows new prices

## Performance Testing

### Load Testing
- [ ] Product list loads < 1s with 1000 products
- [ ] Search filters respond < 500ms
- [ ] Sync completes < 30 seconds for 100+ products
- [ ] Dashboard loads < 2s

### API Response Times
- [ ] Webhook handler responds < 500ms
- [ ] Price update < 2s per product
- [ ] Product sync < 30s for full catalog

## Security Testing

### Authentication
- [ ] JWT tokens validated
- [ ] Expired tokens rejected
- [ ] Invalid tokens rejected
- [ ] Session hijacking not possible

### API Security
- [ ] API key validation works
- [ ] Webhook signature verification required
- [ ] User data isolation enforced
- [ ] Rate limiting prevents abuse

### Data Protection
- [ ] Sensitive data not logged
- [ ] API keys not exposed in frontend
- [ ] CORS headers correct
- [ ] HTTPS enforced in production

## Deployment Testing

### GitHub Actions CI/CD
- [ ] Workflow triggers on push to main
- [ ] Supabase CLI installs successfully
- [ ] Functions deploy without errors
- [ ] Secrets set correctly
- [ ] Build completes in < 10 minutes

### Production Deployment
- [ ] Functions visible in Supabase console
- [ ] Webhook URLs correct
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Frontend builds and deploys

## Manual QA Checklist

### Functionality
- [ ] All menu items work
- [ ] All forms submit successfully
- [ ] All tables display data correctly
- [ ] All charts render properly
- [ ] Filters and search work
- [ ] Buttons are responsive
- [ ] Modals open/close smoothly

### UI/UX
- [ ] Responsive on mobile (< 640px)
- [ ] Responsive on tablet (640-1024px)
- [ ] Responsive on desktop (> 1024px)
- [ ] Loading states show
- [ ] Error messages are clear
- [ ] Success messages appear
- [ ] Form validation clear
- [ ] Color scheme consistent
- [ ] Fonts readable
- [ ] Spacing consistent

### Accessibility
- [ ] Keyboard navigation works
- [ ] Tab order logical
- [ ] Form labels present
- [ ] Contrast meets WCAG standards
- [ ] Screen reader friendly
- [ ] Error messages descriptive

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers

## Test Results Template

```markdown
## Test Run: [Date/Time]

### Frontend Tests: [✓/✗]
- Dashboard: [Status]
- Products: [Status]
- Analytics: [Status]
- Settings: [Status]

### API Tests: [✓/✗]
- Product Sync: [Status]
- Webhook Handler: [Status]
- Price Updates: [Status]

### Database Tests: [✓/✗]
- Schema: [Status]
- Data Integrity: [Status]
- Queries: [Status]

### E2E Tests: [✓/✗]
- Complete Workflow: [Status]

### Issues Found:
- [Issue 1]
- [Issue 2]

### Performance:
- Dashboard Load: [Time]ms
- Product Sync: [Time]s
- Webhook Response: [Time]ms

### Sign-off:
- Tester: [Name]
- Date: [Date]
- Status: [PASS/FAIL]
```

## Running All Tests

```bash
# Build frontend
npm run build

# Run type check
npx tsc --noEmit

# Run linter
npm run lint

# Run manual test checklist
# (See checklist above)
```

## Continuous Monitoring

- Monitor Supabase logs for function errors
- Check GitHub Actions for deployment status
- Review error rates in production
- Monitor API response times
- Check database query performance

## Known Issues & Workarounds

(To be filled in during testing)

---

**Last Updated:** December 8, 2025
**Version:** 1.0.0

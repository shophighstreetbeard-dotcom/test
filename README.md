# Pricer Pro - Takealot Repricing & Analytics Dashboard

**Automated repricing, competitor tracking, and powerful analytics for Takealot sellers.**

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ 
- npm or bun
- Supabase account (free tier supported)
- Takealot Seller API credentials
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/shophighstreetbeard-dotcom/test.git
cd test

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **shadcn/ui** for components
- **TanStack React Query** for state management
- **Supabase JS Client** for real-time data

### Backend
- **Supabase Edge Functions** (Deno runtime)
- **PostgreSQL Database**
- **Real-time webhooks** from Takealot
- **Automated syncing** with Takealot API

### Core Features
- ✅ Product catalog management with images
- ✅ Automated price synchronization
- ✅ Leadtime order tracking & per-warehouse stock
- ✅ Sales recording & analytics
- ✅ AI-powered repricing recommendations
- ✅ Buy box performance tracking
- ✅ Real-time webhook integration
- ✅ Price history & audit logs

## 📋 Setup Instructions

### 1. Environment Variables

Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2. Supabase Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations (creates all tables)
supabase migration up
```

### 3. Deploy Edge Functions

```bash
# Deploy all functions
bash scripts/deploy_to_supabase.sh
```

### 4. Set Secrets

In Supabase Dashboard → Project Settings → Secrets:
- `TAKEALOT_API_KEY` - Your Takealot API key
- `TAKEALOT_WEBHOOK_SECRET` - Webhook signature secret
- `SERVICE_ROLE_KEY` - Supabase service role JWT

### 5. Configure Webhook in Takealot Portal

1. Go to Settings → API Access
2. Add webhook: `https://your-project.supabase.co/functions/v1/takealot-webhook`
3. Enable webhook events for: sales, leadtime orders, offers

## 📱 Pages & Features

### Dashboard
- Key metrics (products, revenue, buy box %, profit)
- Revenue trends chart
- Buy box performance
- Recent activity

### Products
- **Inventory Tab**: Grid view with images, prices, stock
- **Sales Tab**: Order history with revenue tracking
- Sync from Takealot
- Add/Edit/Delete products

### Analytics
- Revenue trends
- Buy box analysis
- Category breakdown
- Repricing activity

### Repricing
- AI recommendations (Gemini)
- Manual repricing
- Price history

### Settings
- Profile management
- API key configuration
- Webhook setup instructions

## 🗄️ Database Schema

Key tables:
- `products` - SKU, price, stock, images
- `sales` - Order records with quantity/price
- `price_history` - Price change audit trail
- `leadtime_orders` - Order item records
- `webhook_events` - Webhook event log

Per-warehouse stock tracked in `leadtime_stock_details` (JSONB).

## 🔧 Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 🧪 Testing

See [TESTING.md](./TESTING.md) for comprehensive test procedures.

Quick verification:
```bash
bash scripts/verify-deployment.sh
bash scripts/seed-test-data.sh
npm run dev
```

## 🔐 Security

- JWT authentication
- HMAC-SHA256 webhook verification
- API key validation
- Rate limiting
- User data isolation
- Environment variable protection

## 📚 Documentation

- [Complete Testing Guide](./TESTING.md)
- [Deployment Scripts](./scripts/)
- [Supabase Documentation](https://supabase.com/docs)
- [Takealot API Guide](https://sellercenter.takealot.com/api)

## 🐛 Troubleshooting

**Functions not deploying:**
```bash
supabase link --project-ref your-ref
supabase functions deploy --all
```

**Products not syncing:**
1. Check `TAKEALOT_API_KEY` is set
2. Review Supabase function logs
3. Verify user_id in request

**Webhooks not received:**
1. Verify webhook URL in Takealot portal
2. Check webhook secret matches
3. Review function logs

## 📄 License

Proprietary - All rights reserved

---

**Status:** Production Ready ✅  
**Last Updated:** December 8, 2025  
**Version:** 1.0.0

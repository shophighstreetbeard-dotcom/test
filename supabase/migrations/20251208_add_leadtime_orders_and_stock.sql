-- Create leadtime_orders table to record incoming leadtime order items
CREATE TABLE IF NOT EXISTS public.leadtime_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id BIGINT NOT NULL,
  order_item_id BIGINT NOT NULL,
  offer_id TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  warehouse TEXT,
  facility JSONB,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add a JSONB column to products to track per-warehouse leadtime stock details
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS leadtime_stock_details JSONB DEFAULT '{}'::jsonb;

-- Index for quick lookups by sku and offer id
CREATE INDEX IF NOT EXISTS idx_products_sku_user ON public.products (sku, user_id);
CREATE INDEX IF NOT EXISTS idx_products_offerid_user ON public.products (takealot_offer_id, user_id);

-- Note: this migration only adds the table/column. Business logic will populate and maintain these fields.

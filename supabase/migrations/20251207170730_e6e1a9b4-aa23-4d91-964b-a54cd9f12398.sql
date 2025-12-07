-- Remove the foreign key constraint that references auth.users
-- This allows using a private user ID that doesn't exist in auth.users
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE public.repricing_rules DROP CONSTRAINT IF EXISTS repricing_rules_user_id_fkey;
ALTER TABLE public.competitors DROP CONSTRAINT IF EXISTS competitors_user_id_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.price_history DROP CONSTRAINT IF EXISTS price_history_user_id_fkey;
ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
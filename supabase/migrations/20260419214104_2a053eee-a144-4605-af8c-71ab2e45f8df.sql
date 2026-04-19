
-- Add minimum price and platform/teacher split percentages to resource_prices
ALTER TABLE public.resource_prices
  ADD COLUMN IF NOT EXISTS min_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_percentage numeric NOT NULL DEFAULT 30;

-- Backfill min_price from current price for existing rows where min_price is 0
UPDATE public.resource_prices
SET min_price = price
WHERE min_price = 0 AND price > 0;

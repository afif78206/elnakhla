ALTER TABLE public.stock_items ADD COLUMN bundle_size integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.stock_items.bundle_size IS 'Unités par fardeau en vente en gros (0 = pas de fardeau)';
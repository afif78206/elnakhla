ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';
CREATE POLICY "product photos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-photos' AND public.is_active_user(auth.uid()));
CREATE POLICY "product photos insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos' AND public.can_write('stock'));
CREATE POLICY "product photos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-photos' AND public.can_write('stock'));
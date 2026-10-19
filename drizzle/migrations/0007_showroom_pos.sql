ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'VENDEUR';
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_barcode_uq ON public.stock_items(barcode) WHERE barcode IS NOT NULL AND barcode <> '';

CREATE OR REPLACE FUNCTION public.showroom_sell(_items jsonb, _mode text, _customer uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare num text; it jsonb; q numeric; si record; n int := 0;
begin
  if not (public.has_any_role(array['VENDEUR','ADMIN','COMMERCIAL'])) then
    raise exception 'Impossible : action réservée aux vendeurs du showroom';
  end if;
  num := public.next_doc_number('TKS', current_date);
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'qty')::numeric;
    if q is null or q <= 0 then continue; end if;
    select * into si from public.stock_items where id = (it->>'item_id')::uuid;
    if si.id is null then raise exception 'Article introuvable'; end if;
    if coalesce(si.sale_price,0) <= 0 then raise exception 'Impossible : % n''a pas de prix de vente', si.name; end if;
    insert into public.sales(number, date, customer_id, item_id, quantity, unit, unit_price, total, paid, remaining, status, payment_mode, notes, created_by, sale_type)
    values ('', current_date, _customer, si.id, q, si.unit, si.sale_price, q*si.sale_price, q*si.sale_price, 0, 'PAYÉ', coalesce(_mode,'espèces'),
      'Showroom ' || num, auth.uid(), case when si.category = 'Huile en vrac' then 'HUILE' else 'EMBALLAGE' end);
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Impossible : panier vide'; end if;
  return num;
end $$;
GRANT EXECUTE ON FUNCTION public.showroom_sell(jsonb, text, uuid) TO authenticated;
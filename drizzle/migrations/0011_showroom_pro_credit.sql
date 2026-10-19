ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS wholesale_price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS wholesale_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE public.customer_payments (
  id uuid PRIMARY KEY,
  number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  amount numeric NOT NULL CHECK (amount > 0),
  mode text NOT NULL,
  debt_before numeric NOT NULL,
  debt_after numeric NOT NULL,
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_payments_read ON public.customer_payments FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['ADMIN','VENDEUR','COMMERCIAL','COMPTABLE']));

CREATE OR REPLACE FUNCTION public.wholesale_unit_price(_item uuid, _qty numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT (t->>'price')::numeric FROM public.stock_items s, jsonb_array_elements(s.wholesale_tiers) t
      WHERE s.id=_item AND (t->>'min')::numeric <= _qty AND (t->>'price')::numeric > 0
      ORDER BY (t->>'min')::numeric DESC LIMIT 1),
    (SELECT nullif(wholesale_price,0) FROM public.stock_items WHERE id=_item),
    (SELECT sale_price FROM public.stock_items WHERE id=_item), 0)
$$;

DROP FUNCTION IF EXISTS public.showroom_document(uuid, text, jsonb, text, numeric, uuid);
CREATE FUNCTION public.showroom_document(_id uuid, _kind text, _items jsonb, _mode text, _paid numeric, _customer uuid DEFAULT NULL, _beneficiary text DEFAULT '', _motive text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE doc public.showroom_documents; num text; it jsonb; si public.stock_items; q numeric; p numeric; tot numeric := 0; left_paid numeric; line_paid numeric; saved_lines jsonb := '[]'; result jsonb; cname text; cphone text; cashier text;
BEGIN
 IF NOT public.has_any_role(ARRAY['ADMIN','VENDEUR','COMMERCIAL']) THEN RAISE EXCEPTION 'Impossible : action réservée aux vendeurs du showroom'; END IF;
 IF _id IS NULL THEN RAISE EXCEPTION 'Identifiant obligatoire'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT * INTO doc FROM public.showroom_documents WHERE id=_id;
 IF FOUND THEN
  IF doc.created_by <> auth.uid() THEN RAISE EXCEPTION 'Impossible : document réservé'; END IF;
  RETURN doc.data;
 END IF;
 IF _kind IS NULL OR _kind NOT IN ('CADEAU','GROS') THEN RAISE EXCEPTION 'Type invalide'; END IF;
 IF _mode IS NULL OR _mode NOT IN ('espèces','TPE') THEN RAISE EXCEPTION 'Paiement invalide'; END IF;
 IF _paid IS NULL OR _paid < 0 OR _paid::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Montant payé invalide'; END IF;
 IF _kind='CADEAU' AND _paid <> 0 THEN RAISE EXCEPTION 'Impossible : cadeau sans encaissement'; END IF;
 IF _kind='CADEAU' AND (coalesce(trim(_beneficiary),'')='' OR coalesce(trim(_motive),'')='') THEN RAISE EXCEPTION 'Bénéficiaire et motif obligatoires'; END IF;
 IF _kind='GROS' AND _customer IS NULL THEN RAISE EXCEPTION 'Client obligatoire'; END IF;
 IF _customer IS NOT NULL THEN
  SELECT name, phone INTO cname, cphone FROM public.customers WHERE id=_customer;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client introuvable'; END IF;
 END IF;
 IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items)=0 THEN RAISE EXCEPTION 'Impossible : panier vide'; END IF;
 PERFORM id FROM public.stock_items WHERE id IN (SELECT (value->>'item_id')::uuid FROM jsonb_array_elements(_items)) ORDER BY id FOR UPDATE;
 FOR it IN SELECT value FROM jsonb_array_elements(_items) LOOP
  q := (it->>'qty')::numeric;
  IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Quantité invalide'; END IF;
  SELECT * INTO si FROM public.stock_items WHERE id=(it->>'item_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable'; END IF;
  IF si.quantity < q THEN RAISE EXCEPTION 'Stock insuffisant pour % (% disponible)', si.name, si.quantity; END IF;
  p := CASE WHEN _kind='CADEAU' THEN 0 ELSE round(public.wholesale_unit_price(si.id, q),2) END;
  IF _kind='GROS' AND p<=0 THEN RAISE EXCEPTION 'Impossible : % n''a pas de prix de gros', si.name; END IF;
  saved_lines:=saved_lines || jsonb_build_array(jsonb_build_object('item_id',si.id,'name',si.name,'qty',q,'price',p,'unit',si.unit,'bundles',it->'bundles','bundle_size',it->'bundle_size'));
  tot:=tot+q*p;
 END LOOP;
 IF _paid > tot THEN RAISE EXCEPTION 'Le montant versé dépasse le total'; END IF;
 num:=public.next_doc_number(CASE WHEN _kind='CADEAU' THEN 'CAD' ELSE 'GRO' END,current_date);
 left_paid:=round(_paid,2);
 FOR it IN SELECT value FROM jsonb_array_elements(saved_lines) LOOP
  q:=(it->>'qty')::numeric; p:=(it->>'price')::numeric;
  IF _kind='CADEAU' THEN
   INSERT INTO public.stock_movements(item_id,quantity,type,reference,user_id,date) VALUES ((it->>'item_id')::uuid,-q,'sortie','Cadeau '||num,auth.uid(),current_date);
  ELSE
   line_paid:=least(left_paid,q*p); left_paid:=left_paid-line_paid;
   INSERT INTO public.sales(number,date,customer_id,item_id,quantity,unit,unit_price,paid,payment_mode,notes,created_by,sale_type)
   SELECT '',current_date,_customer,si2.id,q,si2.unit,p,line_paid,_mode,'Vente en gros '||num,auth.uid(),CASE WHEN si2.category='Huile en vrac' THEN 'HUILE' ELSE 'EMBALLAGE' END FROM public.stock_items si2 WHERE si2.id=(it->>'item_id')::uuid;
  END IF;
 END LOOP;
 SELECT trim(first_name||' '||last_name) INTO cashier FROM public.profiles WHERE id=auth.uid();
 result:=jsonb_build_object('number',num,'kind',_kind,'at',now(),'customer',coalesce(cname,''),'customer_id',_customer,'customer_phone',coalesce(cphone,''),'driver',coalesce(cashier,''),'lines',saved_lines,'total',tot,'paid',round(_paid,2),'mode',_mode,'beneficiary',coalesce(_beneficiary,''),'motive',coalesce(_motive,''));
 INSERT INTO public.showroom_documents(id,number,kind,data,created_by) VALUES (_id,num,_kind,result,auth.uid());
 INSERT INTO public.activity_logs(user_id,action,module,reference) VALUES(auth.uid(),CASE WHEN _kind='CADEAU' THEN 'a offert des produits à '||_beneficiary||' ('||_motive||')' ELSE 'a enregistré une vente en gros' END,'Showroom',num);
 RETURN result;
END $function$;
GRANT EXECUTE ON FUNCTION public.showroom_document(uuid, text, jsonb, text, numeric, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_customer_payment(_id uuid, _customer uuid, _amount numeric, _mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE existing public.customer_payments; debt numeric; left_amt numeric; s record; part numeric; alloc jsonb := '[]'; num text; cname text;
BEGIN
 IF NOT public.has_any_role(ARRAY['ADMIN','VENDEUR','COMMERCIAL','COMPTABLE']) THEN RAISE EXCEPTION 'Impossible : action non autorisée'; END IF;
 IF _id IS NULL OR _customer IS NULL THEN RAISE EXCEPTION 'Client obligatoire'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT * INTO existing FROM public.customer_payments WHERE id=_id;
 IF FOUND THEN RETURN to_jsonb(existing); END IF;
 IF _mode IS NULL OR _mode NOT IN ('espèces','TPE','virement','chèque') THEN RAISE EXCEPTION 'Mode de paiement invalide'; END IF;
 IF _amount IS NULL OR _amount <= 0 OR _amount::text IN ('NaN','Infinity') THEN RAISE EXCEPTION 'Montant invalide'; END IF;
 SELECT name INTO cname FROM public.customers WHERE id=_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client introuvable'; END IF;
 SELECT coalesce(sum(remaining),0) INTO debt FROM public.sales WHERE customer_id=_customer AND remaining>0;
 IF _amount > debt THEN RAISE EXCEPTION 'Le versement (% DA) dépasse la dette (% DA)', _amount, debt; END IF;
 left_amt := round(_amount,2);
 FOR s IN SELECT id, number, remaining FROM public.sales WHERE customer_id=_customer AND remaining>0 ORDER BY date, created_at FOR UPDATE LOOP
  EXIT WHEN left_amt <= 0;
  part := least(left_amt, s.remaining);
  UPDATE public.sales SET paid = paid + part, payment_mode = _mode WHERE id = s.id;
  alloc := alloc || jsonb_build_array(jsonb_build_object('sale',s.number,'amount',part));
  left_amt := left_amt - part;
 END LOOP;
 num := public.next_doc_number('VRS', current_date);
 INSERT INTO public.customer_payments(id,number,customer_id,amount,mode,debt_before,debt_after,allocations,created_by)
 VALUES (_id,num,_customer,round(_amount,2),_mode,debt,debt-round(_amount,2),alloc,auth.uid()) RETURNING * INTO existing;
 INSERT INTO public.activity_logs(user_id,action,module,reference) VALUES(auth.uid(),'a enregistré un versement de '||cname,'Showroom',num);
 RETURN to_jsonb(existing);
END $function$;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(uuid, uuid, numeric, text) TO authenticated;
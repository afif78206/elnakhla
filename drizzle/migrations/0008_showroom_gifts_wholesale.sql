CREATE TABLE public.showroom_documents (
 id uuid PRIMARY KEY,
 number text NOT NULL UNIQUE,
 kind text NOT NULL CHECK (kind IN ('CADEAU','GROS')),
 data jsonb NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.showroom_documents TO authenticated;
GRANT ALL ON public.showroom_documents TO service_role;
ALTER TABLE public.showroom_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY showroom_documents_read ON public.showroom_documents FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['ADMIN','VENDEUR','COMMERCIAL']));
CREATE OR REPLACE FUNCTION public.showroom_document(_id uuid, _kind text, _items jsonb, _mode text, _paid numeric, _customer uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE doc public.showroom_documents; num text; it jsonb; si public.stock_items; q numeric; p numeric; tot numeric := 0; left_paid numeric; line_paid numeric; saved_lines jsonb := '[]'; result jsonb; cname text; cashier text;
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
 IF _kind='GROS' AND _customer IS NULL THEN RAISE EXCEPTION 'Client obligatoire'; END IF;
 IF _customer IS NOT NULL THEN
  SELECT name INTO cname FROM public.customers WHERE id=_customer;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client introuvable'; END IF;
 END IF;
 IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items)=0 THEN RAISE EXCEPTION 'Impossible : panier vide'; END IF;
 -- Lock stock in stable order; triggers remain the only stock mutation path.
 PERFORM id FROM public.stock_items WHERE id IN (SELECT (value->>'item_id')::uuid FROM jsonb_array_elements(_items)) ORDER BY id FOR UPDATE;
 FOR it IN SELECT value FROM jsonb_array_elements(_items) LOOP
  q := (it->>'qty')::numeric;
  IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Quantité invalide'; END IF;
  SELECT * INTO si FROM public.stock_items WHERE id=(it->>'item_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable'; END IF;
  p := CASE WHEN _kind='CADEAU' THEN 0 ELSE (it->>'price')::numeric END;
  IF p IS NULL OR p<=0 AND _kind='GROS' OR p::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Prix invalide'; END IF;
  p:=round(p,2);
  saved_lines:=saved_lines || jsonb_build_array(jsonb_build_object('item_id',si.id,'name',si.name,'qty',q,'price',p,'unit',si.unit));
  tot:=tot+round(q*p,2);
 END LOOP;
 IF _paid > tot THEN RAISE EXCEPTION 'Montant payé invalide'; END IF;
 num:=public.next_doc_number(CASE WHEN _kind='CADEAU' THEN 'CAD' ELSE 'GRO' END,current_date);
 left_paid:=round(_paid,2);
 FOR it IN SELECT value FROM jsonb_array_elements(saved_lines) LOOP
  q:=(it->>'qty')::numeric; p:=(it->>'price')::numeric;
  IF _kind='CADEAU' THEN
   INSERT INTO public.stock_movements(item_id,quantity,type,reference,user_id,date) VALUES ((it->>'item_id')::uuid,-q,'sortie','Cadeau '||num,auth.uid(),current_date);
  ELSE
   line_paid:=least(left_paid,round(q*p,2)); left_paid:=left_paid-line_paid;
   INSERT INTO public.sales(number,date,customer_id,item_id,quantity,unit,unit_price,paid,payment_mode,notes,created_by,sale_type)
   SELECT '',current_date,_customer,si2.id,q,si2.unit,p,line_paid,_mode,'Vente en gros '||num,auth.uid(),CASE WHEN si2.category='Huile en vrac' THEN 'HUILE' ELSE 'EMBALLAGE' END FROM public.stock_items si2 WHERE si2.id=(it->>'item_id')::uuid;
  END IF;
 END LOOP;
 SELECT trim(first_name||' '||last_name) INTO cashier FROM public.profiles WHERE id=auth.uid();
 -- Sales calculate quantity * unit_price without rounding; align document with those totals.
 SELECT coalesce(sum((value->>'qty')::numeric*(value->>'price')::numeric),0) INTO tot FROM jsonb_array_elements(saved_lines);
 result:=jsonb_build_object('number',num,'kind',_kind,'at',now(),'customer',coalesce(cname,''),'driver',coalesce(cashier,''),'lines',saved_lines,'total',tot,'paid',round(_paid,2),'mode',_mode);
 INSERT INTO public.showroom_documents(id,number,kind,data,created_by) VALUES (_id,num,_kind,result,auth.uid());
 INSERT INTO public.activity_logs(user_id,action,module,reference) VALUES(auth.uid(),CASE WHEN _kind='CADEAU' THEN 'a offert des produits sans encaissement' ELSE 'a enregistré une vente en gros' END,'Showroom',num);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.showroom_document(uuid,text,jsonb,text,numeric,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.showroom_document(uuid,text,jsonb,text,numeric,uuid) TO authenticated,service_role;
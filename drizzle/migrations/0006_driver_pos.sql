ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'CHAUFFEUR';

ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS sale_price numeric NOT NULL DEFAULT 0;

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plate text NOT NULL DEFAULT '',
  driver_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vehicle_stock (
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (vehicle_id, item_id)
);
CREATE TABLE public.driver_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  driver_id uuid NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id),
  status text NOT NULL DEFAULT 'OUVERTE',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  cash_expected numeric NOT NULL DEFAULT 0,
  cash_handed numeric NOT NULL DEFAULT 0,
  handover_status text NOT NULL DEFAULT 'A_REMETTRE',
  validated_by uuid,
  validated_at timestamptz
);
CREATE TABLE public.vehicle_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL DEFAULT '',
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  driver_id uuid,
  route_id uuid REFERENCES public.driver_routes(id),
  item_id uuid NOT NULL REFERENCES public.stock_items(id),
  quantity numeric NOT NULL,
  type text NOT NULL,
  reference text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  date date NOT NULL DEFAULT current_date,
  customer_id uuid REFERENCES public.customers(id),
  driver_id uuid,
  vehicle_id uuid REFERENCES public.vehicles(id),
  route_id uuid REFERENCES public.driver_routes(id),
  address text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'A_LIVRER',
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'espèces',
  notes text NOT NULL DEFAULT '',
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.driver_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  route_id uuid REFERENCES public.driver_routes(id),
  driver_id uuid NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id),
  customer_id uuid REFERENCES public.customers(id),
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  remaining numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'espèces',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.driver_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.driver_sales(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.driver_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.driver_routes(id),
  driver_id uuid NOT NULL,
  amount numeric NOT NULL,
  mode text NOT NULL,
  source text NOT NULL,
  reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT ON public.vehicle_stock, public.driver_routes, public.vehicle_stock_movements, public.deliveries, public.delivery_items, public.driver_sales, public.driver_sale_items, public.driver_cash_movements TO authenticated;
GRANT ALL ON public.vehicles, public.vehicle_stock, public.driver_routes, public.vehicle_stock_movements, public.deliveries, public.delivery_items, public.driver_sales, public.driver_sale_items, public.driver_cash_movements TO service_role;

CREATE OR REPLACE FUNCTION public.is_driver() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role::text = 'CHAUFFEUR')
$$;
CREATE OR REPLACE FUNCTION public.has_any_role(_roles text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.is_active_user(auth.uid()) and exists(select 1 from public.user_roles where user_id = auth.uid() and role::text = any(_roles))
$$;
CREATE OR REPLACE FUNCTION public.my_vehicle() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select id from public.vehicles where driver_id = auth.uid() and active order by created_at limit 1
$$;
CREATE OR REPLACE FUNCTION public.fleet_can_see(_driver uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.is_active_user(auth.uid()) and (not public.is_driver() or _driver = auth.uid())
$$;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.fleet_can_see(driver_id));
CREATE POLICY "insert vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.has_any_role(array['ADMIN','MAGASINIER']));
CREATE POLICY "update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (public.has_any_role(array['ADMIN','MAGASINIER'])) WITH CHECK (public.has_any_role(array['ADMIN','MAGASINIER']));
CREATE POLICY "delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (public.has_any_role(array['ADMIN']));
CREATE POLICY "read vstock" ON public.vehicle_stock FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()) and (not public.is_driver() or vehicle_id = public.my_vehicle()));
CREATE POLICY "read routes" ON public.driver_routes FOR SELECT TO authenticated USING (public.fleet_can_see(driver_id));
CREATE POLICY "read vmov" ON public.vehicle_stock_movements FOR SELECT TO authenticated USING (public.fleet_can_see(driver_id));
CREATE POLICY "read deliveries" ON public.deliveries FOR SELECT TO authenticated USING (public.fleet_can_see(driver_id));
CREATE POLICY "read delivery items" ON public.delivery_items FOR SELECT TO authenticated USING (exists(select 1 from public.deliveries d where d.id = delivery_id and public.fleet_can_see(d.driver_id)));
CREATE POLICY "read dsales" ON public.driver_sales FOR SELECT TO authenticated USING (public.fleet_can_see(driver_id));
CREATE POLICY "read dsale items" ON public.driver_sale_items FOR SELECT TO authenticated USING (exists(select 1 from public.driver_sales s where s.id = sale_id and public.fleet_can_see(s.driver_id)));
CREATE POLICY "read dcash" ON public.driver_cash_movements FOR SELECT TO authenticated USING (public.fleet_can_see(driver_id));

-- tournée ouverte (créée si besoin)
CREATE OR REPLACE FUNCTION public.route_for(_driver uuid, _vehicle uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r uuid;
begin
  if _driver is null then return null; end if;
  select id into r from public.driver_routes where driver_id = _driver and status = 'OUVERTE' order by opened_at desc limit 1;
  if r is null then
    insert into public.driver_routes(number, driver_id, vehicle_id) values (public.next_doc_number('TRN', current_date), _driver, _vehicle) returning id into r;
  end if;
  return r;
end $$;
REVOKE EXECUTE ON FUNCTION public.route_for(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vstock_add(_vehicle uuid, _item uuid, _delta numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cur numeric; nm text;
begin
  insert into public.vehicle_stock(vehicle_id, item_id, quantity) values (_vehicle, _item, 0) on conflict do nothing;
  select quantity into cur from public.vehicle_stock where vehicle_id = _vehicle and item_id = _item for update;
  if cur + _delta < 0 then
    select name into nm from public.stock_items where id = _item;
    raise exception 'Stock véhicule insuffisant pour % : disponible %, demandé %', nm, cur, abs(_delta);
  end if;
  update public.vehicle_stock set quantity = cur + _delta where vehicle_id = _vehicle and item_id = _item;
end $$;
REVOKE EXECUTE ON FUNCTION public.vstock_add(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fleet_load(_vehicle uuid, _items jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare num text; drv uuid; rt uuid; it jsonb; q numeric;
begin
  if not public.has_any_role(array['ADMIN','MAGASINIER']) then raise exception 'Impossible : action réservée au magasinier ou à l''administrateur'; end if;
  select driver_id into drv from public.vehicles where id = _vehicle and active;
  if not found then raise exception 'Véhicule introuvable'; end if;
  num := public.next_doc_number('CHG', current_date);
  rt := public.route_for(drv, _vehicle);
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'qty')::numeric;
    if q is null or q <= 0 then continue; end if;
    insert into public.stock_movements(item_id, quantity, type, reference, user_id) values ((it->>'item_id')::uuid, -q, 'sortie', num, auth.uid());
    perform public.vstock_add(_vehicle, (it->>'item_id')::uuid, q);
    insert into public.vehicle_stock_movements(number, vehicle_id, driver_id, route_id, item_id, quantity, type, reference, created_by)
      values (num, _vehicle, drv, rt, (it->>'item_id')::uuid, q, 'CHARGEMENT', 'Chargement véhicule', auth.uid());
  end loop;
  insert into public.activity_logs(user_id, action, module, reference) values (auth.uid(), 'a chargé un véhicule', 'Flotte', num);
  return num;
end $$;

CREATE OR REPLACE FUNCTION public.create_delivery(_customer uuid, _vehicle uuid, _date date, _address text, _notes text, _items jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare num text; drv uuid; did uuid; it jsonb; q numeric; p numeric; tot numeric := 0;
begin
  if not public.has_any_role(array['ADMIN','MAGASINIER','COMMERCIAL']) then raise exception 'Impossible : action réservée'; end if;
  select driver_id into drv from public.vehicles where id = _vehicle;
  num := public.next_doc_number('BL', coalesce(_date, current_date));
  insert into public.deliveries(number, date, customer_id, driver_id, vehicle_id, address, notes, created_by)
    values (num, coalesce(_date, current_date), _customer, drv, _vehicle, coalesce(_address,''), coalesce(_notes,''), auth.uid()) returning id into did;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'qty')::numeric; p := coalesce((it->>'price')::numeric, 0);
    if q is null or q <= 0 then continue; end if;
    insert into public.delivery_items(delivery_id, item_id, quantity, unit_price, total) values (did, (it->>'item_id')::uuid, q, p, q*p);
    tot := tot + q*p;
  end loop;
  update public.deliveries set total = tot where id = did;
  insert into public.activity_logs(user_id, action, module, reference) values (auth.uid(), 'a créé une livraison', 'Flotte', num);
  return num;
end $$;

CREATE OR REPLACE FUNCTION public.set_delivery_status(_id uuid, _status text, _notes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare d public.deliveries;
begin
  select * into d from public.deliveries where id = _id for update;
  if not found then raise exception 'Livraison introuvable'; end if;
  if d.status = 'LIVREE' then raise exception 'Impossible : livraison déjà validée'; end if;
  if _status not in ('A_LIVRER','EN_COURS','ECHEC','REPORTEE','ANNULEE') then raise exception 'Statut invalide'; end if;
  if public.is_driver() then
    if d.driver_id <> auth.uid() or _status = 'ANNULEE' then raise exception 'Impossible : action non autorisée'; end if;
  elsif not public.has_any_role(array['ADMIN','MAGASINIER','COMMERCIAL']) then raise exception 'Impossible : action non autorisée'; end if;
  update public.deliveries set status = _status, notes = case when coalesce(_notes,'') = '' then notes else _notes end where id = _id;
end $$;

CREATE OR REPLACE FUNCTION public.complete_delivery(_id uuid, _paid numeric, _mode text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare d public.deliveries; it record; rt uuid;
begin
  select * into d from public.deliveries where id = _id for update;
  if not found then raise exception 'Livraison introuvable'; end if;
  if not public.is_active_user(auth.uid()) or d.driver_id is distinct from auth.uid() then raise exception 'Impossible : cette livraison n''est pas la vôtre'; end if;
  if d.status = 'LIVREE' then raise exception 'Impossible : livraison déjà validée'; end if;
  if d.status = 'ANNULEE' then raise exception 'Impossible : livraison annulée'; end if;
  if coalesce(_paid,0) < 0 or coalesce(_paid,0) > d.total then raise exception 'Montant payé invalide'; end if;
  rt := public.route_for(d.driver_id, d.vehicle_id);
  for it in select * from public.delivery_items where delivery_id = _id loop
    perform public.vstock_add(d.vehicle_id, it.item_id, -it.quantity);
    insert into public.vehicle_stock_movements(number, vehicle_id, driver_id, route_id, item_id, quantity, type, reference, created_by)
      values (d.number, d.vehicle_id, d.driver_id, rt, it.item_id, -it.quantity, 'LIVRAISON', d.number, auth.uid());
  end loop;
  update public.deliveries set status = 'LIVREE', paid = coalesce(_paid,0), payment_mode = coalesce(_mode,'espèces'), delivered_at = now(), route_id = rt where id = _id;
  if coalesce(_paid,0) > 0 then
    insert into public.driver_cash_movements(route_id, driver_id, amount, mode, source, reference) values (rt, d.driver_id, _paid, coalesce(_mode,'espèces'), 'LIVRAISON', d.number);
  end if;
  if d.total - coalesce(_paid,0) > 0 then
    insert into public.driver_cash_movements(route_id, driver_id, amount, mode, source, reference) values (rt, d.driver_id, d.total - coalesce(_paid,0), 'crédit', 'LIVRAISON', d.number);
  end if;
  return d.number;
end $$;

CREATE OR REPLACE FUNCTION public.driver_sell(_customer uuid, _items jsonb, _paid numeric, _mode text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v uuid; rt uuid; num text; sid uuid; it jsonb; q numeric; p numeric; tot numeric := 0;
begin
  if not (public.is_active_user(auth.uid()) and public.is_driver()) then raise exception 'Impossible : action réservée aux chauffeurs'; end if;
  v := public.my_vehicle();
  if v is null then raise exception 'Impossible : aucun véhicule ne vous est affecté'; end if;
  rt := public.route_for(auth.uid(), v);
  num := public.next_doc_number('VCH', current_date);
  insert into public.driver_sales(number, route_id, driver_id, vehicle_id, customer_id) values (num, rt, auth.uid(), v, _customer) returning id into sid;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'qty')::numeric;
    if q is null or q <= 0 then continue; end if;
    select sale_price into p from public.stock_items where id = (it->>'item_id')::uuid;
    if coalesce(p,0) = 0 then p := greatest(coalesce((it->>'price')::numeric,0),0); end if;
    perform public.vstock_add(v, (it->>'item_id')::uuid, -q);
    insert into public.driver_sale_items(sale_id, item_id, quantity, unit_price, total) values (sid, (it->>'item_id')::uuid, q, p, q*p);
    insert into public.vehicle_stock_movements(number, vehicle_id, driver_id, route_id, item_id, quantity, type, reference, created_by)
      values (num, v, auth.uid(), rt, (it->>'item_id')::uuid, -q, 'VENTE', num, auth.uid());
    tot := tot + q*p;
  end loop;
  if tot <= 0 then raise exception 'Impossible : panier vide'; end if;
  if coalesce(_paid,0) < 0 or coalesce(_paid,0) > tot then raise exception 'Montant payé invalide'; end if;
  if coalesce(_paid,0) < tot and _customer is null then raise exception 'Impossible : un client est obligatoire pour une vente à crédit'; end if;
  update public.driver_sales set total = tot, paid = coalesce(_paid,0), remaining = tot - coalesce(_paid,0), payment_mode = coalesce(_mode,'espèces') where id = sid;
  if coalesce(_paid,0) > 0 then
    insert into public.driver_cash_movements(route_id, driver_id, amount, mode, source, reference) values (rt, auth.uid(), _paid, coalesce(_mode,'espèces'), 'VENTE', num);
  end if;
  if tot - coalesce(_paid,0) > 0 then
    insert into public.driver_cash_movements(route_id, driver_id, amount, mode, source, reference) values (rt, auth.uid(), tot - coalesce(_paid,0), 'crédit', 'VENTE', num);
  end if;
  return num;
end $$;

CREATE OR REPLACE FUNCTION public.driver_return(_items jsonb, _damaged boolean, _notes text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v uuid; rt uuid; num text; it jsonb; q numeric;
begin
  if not (public.is_active_user(auth.uid()) and public.is_driver()) then raise exception 'Impossible : action réservée aux chauffeurs'; end if;
  v := public.my_vehicle();
  if v is null then raise exception 'Impossible : aucun véhicule ne vous est affecté'; end if;
  rt := public.route_for(auth.uid(), v);
  num := public.next_doc_number('RET', current_date);
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'qty')::numeric;
    if q is null or q <= 0 then continue; end if;
    perform public.vstock_add(v, (it->>'item_id')::uuid, -q);
    if not coalesce(_damaged,false) then
      insert into public.stock_movements(item_id, quantity, type, reference, user_id) values ((it->>'item_id')::uuid, q, 'entrée', num, auth.uid());
    end if;
    insert into public.vehicle_stock_movements(number, vehicle_id, driver_id, route_id, item_id, quantity, type, reference, created_by)
      values (num, v, auth.uid(), rt, (it->>'item_id')::uuid, -q, case when coalesce(_damaged,false) then 'PERTE' else 'RETOUR' end, coalesce(nullif(_notes,''), num), auth.uid());
  end loop;
  return num;
end $$;

CREATE OR REPLACE FUNCTION public.close_route(_cash_handed numeric) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r public.driver_routes; s jsonb; cash numeric;
begin
  if not (public.is_active_user(auth.uid()) and public.is_driver()) then raise exception 'Impossible : action réservée aux chauffeurs'; end if;
  select * into r from public.driver_routes where driver_id = auth.uid() and status = 'OUVERTE' order by opened_at desc limit 1 for update;
  if not found then raise exception 'Impossible : aucune tournée ouverte'; end if;
  select coalesce(sum(amount),0) into cash from public.driver_cash_movements where route_id = r.id and mode = 'espèces';
  select jsonb_build_object(
    'charge', coalesce(sum(quantity) filter (where type='CHARGEMENT'),0),
    'livre', coalesce(-sum(quantity) filter (where type='LIVRAISON'),0),
    'vendu', coalesce(-sum(quantity) filter (where type='VENTE'),0),
    'retour', coalesce(-sum(quantity) filter (where type='RETOUR'),0),
    'perte', coalesce(-sum(quantity) filter (where type='PERTE'),0)) into s
  from public.vehicle_stock_movements where route_id = r.id;
  s := s || (select jsonb_build_object(
    'especes', coalesce(sum(amount) filter (where mode='espèces'),0),
    'virement', coalesce(sum(amount) filter (where mode='virement'),0),
    'cheque', coalesce(sum(amount) filter (where mode='chèque'),0),
    'credit', coalesce(sum(amount) filter (where mode='crédit'),0)) from public.driver_cash_movements where route_id = r.id);
  update public.driver_routes set status='CLOTUREE', closed_at=now(), summary=s, cash_expected=cash, cash_handed=greatest(coalesce(_cash_handed,0),0), handover_status='REMIS' where id = r.id;
  insert into public.activity_logs(user_id, action, module, reference) values (auth.uid(), 'a clôturé sa tournée', 'Chauffeur', r.number);
  return r.number;
end $$;

CREATE OR REPLACE FUNCTION public.validate_route(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r public.driver_routes;
begin
  if not public.has_any_role(array['ADMIN','COMPTABLE']) then raise exception 'Impossible : action réservée à l''administrateur ou au comptable'; end if;
  select * into r from public.driver_routes where id = _id for update;
  if not found or r.status <> 'CLOTUREE' or r.handover_status = 'VALIDE' then raise exception 'Impossible : tournée non clôturée ou déjà validée'; end if;
  update public.driver_routes set handover_status='VALIDE', validated_by=auth.uid(), validated_at=now() where id = _id;
  if r.cash_handed > 0 then
    insert into public.cash_movements(date, type, amount, source, motive, reference, user_id, created_by, dedupe_key)
      values (current_date, 'ENTREE', r.cash_handed, 'Remise chauffeur', 'Remise de caisse tournée', r.number, auth.uid(), auth.uid(), 'route:' || r.id);
  end if;
  insert into public.activity_logs(user_id, action, module, reference) values (auth.uid(), 'a validé une remise de caisse', 'Flotte', r.number);
end $$;

CREATE OR REPLACE FUNCTION public.driver_add_customer(_name text, _phone text, _address text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cid uuid;
begin
  if not (public.is_active_user(auth.uid()) and (public.is_driver() or public.can_write('customers'))) then raise exception 'Impossible : action non autorisée'; end if;
  if coalesce(trim(_name),'') = '' then raise exception 'Impossible : nom obligatoire'; end if;
  insert into public.customers(name, phone, address, created_by) values (trim(_name), coalesce(_phone,''), coalesce(_address,''), auth.uid()) returning id into cid;
  return cid;
end $$;

REVOKE EXECUTE ON FUNCTION public.fleet_load(uuid, jsonb), public.create_delivery(uuid, uuid, date, text, text, jsonb), public.set_delivery_status(uuid, text, text), public.complete_delivery(uuid, numeric, text), public.driver_sell(uuid, jsonb, numeric, text), public.driver_return(jsonb, boolean, text), public.close_route(numeric), public.validate_route(uuid), public.driver_add_customer(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_load(uuid, jsonb), public.create_delivery(uuid, uuid, date, text, text, jsonb), public.set_delivery_status(uuid, text, text), public.complete_delivery(uuid, numeric, text), public.driver_sell(uuid, jsonb, numeric, text), public.driver_return(jsonb, boolean, text), public.close_route(numeric), public.validate_route(uuid), public.driver_add_customer(text, text, text) TO authenticated;
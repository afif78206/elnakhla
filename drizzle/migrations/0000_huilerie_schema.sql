
create type public.app_role as enum ('ADMIN','RESPONSABLE_PRODUCTION','MAGASINIER','COMMERCIAL','COMPTABLE','CONSULTATION');

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

-- profiles
create table public.profiles (
  id uuid primary key,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create or replace function public.is_active_user(_user_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=_user_id and active)
$$;

create or replace function public.can_write(_module text) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_active_user(auth.uid()) and exists (
    select 1 from public.user_roles r where r.user_id = auth.uid() and (
      r.role='ADMIN'
      or (r.role='RESPONSABLE_PRODUCTION' and _module in ('receptions','production','suppliers'))
      or (r.role='MAGASINIER' and _module in ('stock'))
      or (r.role='COMMERCIAL' and _module in ('customers','sales'))
      or (r.role='COMPTABLE' and _module in ('expenses'))
    ))
$$;

create policy "read profiles" on public.profiles for select to authenticated using (auth.uid() = id or public.is_active_user(auth.uid()));
create policy "read roles" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.is_active_user(auth.uid()));
create trigger t_profiles_upd before update on public.profiles for each row execute function public.touch_updated_at();

-- generic business tables
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, company text not null default '', phone text not null default '',
  address text not null default '', wilaya text not null default '', commune text not null default '',
  type text not null default 'agriculteur', notes text not null default '',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, company text not null default '', phone text not null default '',
  address text not null default '', wilaya text not null default '',
  type text not null default 'particulier', notes text not null default '',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.olive_receptions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique, date date not null default current_date, time text not null default '',
  supplier_id uuid references public.suppliers(id) on delete restrict,
  weight_kg numeric not null check (weight_kg > 0), variety text not null default '', origin text not null default '',
  price_per_kg numeric not null default 0, total numeric not null default 0,
  condition text not null default 'Bon', notes text not null default '',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null, quantity numeric not null default 0 check (quantity >= 0),
  unit text not null default 'unité', min_quantity numeric not null default 0, location text not null default '',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.productions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique, date date not null default current_date,
  reception_id uuid references public.olive_receptions(id) on delete set null,
  olives_kg numeric not null check (olives_kg > 0), oil_liters numeric not null check (oil_liters >= 0),
  byproducts_kg numeric not null default 0, yield_pct numeric not null default 0, notes text not null default '',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  item_id uuid not null references public.stock_items(id) on delete cascade,
  quantity numeric not null, type text not null, user_id uuid default auth.uid(), reference text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  number text not null unique, date date not null default current_date,
  customer_id uuid references public.customers(id) on delete restrict,
  item_id uuid references public.stock_items(id) on delete set null,
  quantity numeric not null check (quantity > 0), unit text not null default 'L',
  unit_price numeric not null default 0, total numeric not null default 0, paid numeric not null default 0,
  remaining numeric not null default 0, status text not null default 'NON_PAYÉ',
  payment_mode text not null default 'espèces', notes text not null default '',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  item_id uuid references public.stock_items(id) on delete set null,
  quantity numeric not null, unit_price numeric not null, total numeric not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  date date not null default current_date, amount numeric not null, mode text not null default 'espèces',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  number text not null unique, date date not null default current_date, category text not null,
  description text not null default '', amount numeric not null check (amount > 0),
  payment_mode text not null default 'espèces', user_id uuid default auth.uid(),
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(), action text not null, module text not null, reference text not null default '',
  at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Huilerie', phone text not null default '', address text not null default '',
  wilaya text not null default '', tax_number text not null default '', currency text not null default 'DZD',
  default_unit text not null default 'L', low_stock_threshold numeric not null default 20,
  number_format text not null default 'PREFIX-ANNEE-0000',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$
declare t text; m text;
begin
  for t, m in select * from (values
    ('suppliers','suppliers'),('customers','customers'),('olive_receptions','receptions'),
    ('stock_items','stock'),('productions','production'),('stock_movements','stock'),
    ('sales','sales'),('sale_items','sales'),('payments','sales'),('expenses','expenses'),('settings','settings')) v(a,b)
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (public.is_active_user(auth.uid()))', t);
    execute format('create policy "insert %1$s" on public.%1$I for insert to authenticated with check (public.can_write(%2$L))', t, m);
    execute format('create policy "update %1$s" on public.%1$I for update to authenticated using (public.can_write(%2$L)) with check (public.can_write(%2$L))', t, m);
    execute format('create policy "delete %1$s" on public.%1$I for delete to authenticated using (public.can_write(%2$L))', t, m);
    execute format('create trigger t_%1$s_upd before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

grant select, insert on public.activity_logs to authenticated;
grant all on public.activity_logs to service_role;
alter table public.activity_logs enable row level security;
create policy "read logs" on public.activity_logs for select to authenticated using (public.is_active_user(auth.uid()));
create policy "insert logs" on public.activity_logs for insert to authenticated with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

-- stock movement applies to item
create or replace function public.apply_stock_movement() returns trigger language plpgsql security definer set search_path=public as $$
declare cur numeric;
begin
  select quantity into cur from public.stock_items where id = new.item_id for update;
  if cur is null then raise exception 'Article de stock introuvable'; end if;
  if cur + new.quantity < 0 then
    raise exception 'Stock insuffisant : disponible %, demandé %', cur, abs(new.quantity);
  end if;
  update public.stock_items set quantity = cur + new.quantity where id = new.item_id;
  return new;
end $$;
create trigger t_apply_movement after insert on public.stock_movements for each row execute function public.apply_stock_movement();

-- production -> stock huile
create or replace function public.on_production_insert() returns trigger language plpgsql security definer set search_path=public as $$
declare bulk uuid;
begin
  new.yield_pct := case when new.olives_kg > 0 then round(new.oil_liters / new.olives_kg * 100, 2) else 0 end;
  return new;
end $$;
create trigger t_prod_before before insert or update on public.productions for each row execute function public.on_production_insert();

create or replace function public.on_production_after() returns trigger language plpgsql security definer set search_path=public as $$
declare bulk uuid;
begin
  select id into bulk from public.stock_items where category = 'Huile en vrac' order by created_at limit 1;
  if bulk is null then raise exception 'Aucun article « Huile en vrac » dans le stock'; end if;
  insert into public.stock_movements(item_id, quantity, type, user_id, reference, date)
  values (bulk, new.oil_liters, 'production', auth.uid(), new.number, new.date);
  return new;
end $$;
create trigger t_prod_after after insert on public.productions for each row execute function public.on_production_after();

-- sales
create or replace function public.on_sale_before() returns trigger language plpgsql set search_path=public as $$
begin
  new.total := new.quantity * new.unit_price;
  if new.paid < 0 or new.paid > new.total then raise exception 'Montant payé invalide'; end if;
  new.remaining := new.total - new.paid;
  new.status := case when new.remaining <= 0 then 'PAYÉ' when new.paid > 0 then 'PARTIELLEMENT_PAYÉ' else 'NON_PAYÉ' end;
  return new;
end $$;
create trigger t_sale_before before insert or update on public.sales for each row execute function public.on_sale_before();

create or replace function public.on_sale_after() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.item_id is not null then
    insert into public.stock_movements(item_id, quantity, type, user_id, reference, date)
    values (new.item_id, -new.quantity, 'vente', auth.uid(), new.number, new.date);
  end if;
  insert into public.sale_items(sale_id, item_id, quantity, unit_price, total)
  values (new.id, new.item_id, new.quantity, new.unit_price, new.total);
  if new.paid > 0 then
    insert into public.payments(sale_id, date, amount, mode, created_by) values (new.id, new.date, new.paid, new.payment_mode, auth.uid());
  end if;
  return new;
end $$;
create trigger t_sale_after after insert on public.sales for each row execute function public.on_sale_after();

create or replace function public.on_reception_before() returns trigger language plpgsql set search_path=public as $$
begin new.total := new.weight_kg * new.price_per_kg; return new; end $$;
create trigger t_rec_before before insert or update on public.olive_receptions for each row execute function public.on_reception_before();

-- demo data
insert into public.settings(id, company_name, phone, address, wilaya, tax_number) values
 (1,'Huilerie El Zitoun','027 77 12 34','Route nationale 4','Chlef','000 123 456 789');

insert into public.suppliers(id,name,company,phone,address,wilaya,commune,type,notes,created_by) values
 ('11111111-0000-0000-0000-000000000001','Benali','Ahmed','0550 11 22 33','Douar Ouled Fares','Chlef','Ouled Fares','agriculteur','Fournisseur régulier',null),
 ('11111111-0000-0000-0000-000000000002','Meziane','Rachid','0661 44 55 66','Cité des oliviers','Tizi Ouzou','Azazga','agriculteur','',null),
 ('11111111-0000-0000-0000-000000000003','Coopérative','Coop Oliveraie','0770 88 99 00','Zone agricole','Béjaïa','Akbou','fournisseur','',null);

insert into public.customers(id,name,company,phone,address,wilaya,type,notes,created_by) values
 ('22222222-0000-0000-0000-000000000001','Bahia','SARL El Bahia','0550 90 80 70','Zone industrielle','Oran','professionnel','Client grossiste',null),
 ('22222222-0000-0000-0000-000000000002','Hamidi','Fatima','0661 12 12 12','Centre-ville','Chlef','particulier','',null);

insert into public.stock_items(id,name,category,quantity,unit,min_quantity,location,created_by) values
 ('33333333-0000-0000-0000-000000000001','Huile d''olive en vrac','Huile en vrac',1840,'L',300,'Cuve 1',null),
 ('33333333-0000-0000-0000-000000000002','Bouteille 1 L','Bouteilles',120,'unité',200,'Magasin A',null),
 ('33333333-0000-0000-0000-000000000003','Bidon 5 L','Bidons',340,'unité',100,'Magasin A',null),
 ('33333333-0000-0000-0000-000000000004','Bouchons','Bouchons',2500,'unité',500,'Magasin B',null),
 ('33333333-0000-0000-0000-000000000005','Cartons x12','Cartons',80,'carton',30,'Magasin B',null),
 ('33333333-0000-0000-0000-000000000006','Étiquettes','Étiquettes',1500,'unité',300,'Bureau',null);

insert into public.olive_receptions(id,number,date,time,supplier_id,weight_kg,variety,origin,price_per_kg,condition,notes,created_by) values
 ('44444444-0000-0000-0000-000000000001','REC-2026-0001',current_date - 2,'08:30','11111111-0000-0000-0000-000000000001',2500,'Chemlal','Chlef',120,'Bon','',null),
 ('44444444-0000-0000-0000-000000000002','REC-2026-0002',current_date - 1,'09:15','11111111-0000-0000-0000-000000000002',1800,'Sigoise','Tizi Ouzou',115,'Bon','',null);

insert into public.productions(id,number,date,reception_id,olives_kg,oil_liters,byproducts_kg,notes,created_by) values
 ('55555555-0000-0000-0000-000000000001','PROD-2026-0001',current_date - 1,'44444444-0000-0000-0000-000000000001',1000,175,600,'Trituration à froid',null);

insert into public.sales(id,number,date,customer_id,item_id,quantity,unit,unit_price,paid,payment_mode,notes,created_by) values
 ('66666666-0000-0000-0000-000000000001','VTE-2026-0001',current_date,'22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',50,'L',1200,60000,'espèces','',null);

insert into public.expenses(number,date,category,description,amount,payment_mode,user_id,created_by) values
 ('DEP-2026-0001',current_date,'Électricité','Facture Sonelgaz',18500,'virement',null,null);

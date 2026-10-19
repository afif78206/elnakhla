
-- 1. Réception : choix client, paiement, transformation, annulation
alter table public.olive_receptions
  add column client_choice text not null default 'NON_RENSEIGNE',
  add column sold_kg numeric not null default 0,
  add column oil_kg numeric not null default 0,
  add column paid numeric not null default 0,
  add column remaining numeric not null default 0,
  add column payment_status text not null default 'NON_PAYÉ',
  add column transform_status text not null default 'EN_ATTENTE',
  add column cancelled boolean not null default false;

alter table public.olive_receptions
  add constraint rec_choice_check check (client_choice in ('NON_RENSEIGNE','VENTE_OLIVES','TRANSFORMATION_HUILE','MIXTE')),
  add constraint rec_transform_check check (transform_status in ('EN_ATTENTE','HUILE_DISPONIBLE','HUILE_RECUPEREE'));

-- 2. Calcul total / paiement selon le choix client (remplace l'ancien calcul simple)
create or replace function public.on_reception_before()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.client_choice = 'VENTE_OLIVES' then
    new.sold_kg := new.weight_kg;
    new.oil_kg := 0;
  elsif new.client_choice = 'TRANSFORMATION_HUILE' then
    new.sold_kg := 0;
    new.oil_kg := new.weight_kg;
  elsif new.client_choice = 'MIXTE' then
    if new.sold_kg < 0 or new.oil_kg < 0 or new.sold_kg + new.oil_kg <> new.weight_kg then
      raise exception 'Mixte invalide : partie vendue + partie huile doit être égale au poids total';
    end if;
  else
    new.client_choice := 'NON_RENSEIGNE';
    new.sold_kg := 0;
    new.oil_kg := 0;
  end if;
  new.total := case when new.client_choice = 'NON_RENSEIGNE'
                    then new.weight_kg * new.price_per_kg
                    else new.sold_kg * new.price_per_kg end;
  if new.paid < 0 or new.paid > new.total then
    raise exception 'Montant payé invalide';
  end if;
  new.remaining := new.total - new.paid;
  new.payment_status := case
    when new.total <= 0 then 'NON_PAYÉ'
    when new.remaining <= 0 then 'PAYÉ'
    when new.paid > 0 then 'PARTIELLEMENT_PAYÉ'
    else 'NON_PAYÉ' end;
  return new;
end $$;

-- 3. Prix du jour dans les paramètres
alter table public.settings add column daily_price numeric not null default 0;

-- 4. Type de vente (huile / emballage)
alter table public.sales add column sale_type text not null default 'HUILE';
alter table public.sales add constraint sales_type_check check (sale_type in ('HUILE','EMBALLAGE'));

-- 5. Caisse
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  number text not null default '',
  date date not null default current_date,
  time text not null default '',
  type text not null check (type in ('ENTREE','SORTIE')),
  amount numeric not null check (amount > 0),
  source text not null default '',
  motive text not null default '',
  reference text not null default '',
  dedupe_key text,
  user_id uuid default auth.uid(),
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cash_movements_dedupe_key on public.cash_movements(dedupe_key) where dedupe_key is not null;

grant select, insert, update, delete on public.cash_movements to authenticated;
grant all on public.cash_movements to service_role;

alter table public.cash_movements enable row level security;
create policy "read cash" on public.cash_movements for select to authenticated using (is_active_user(auth.uid()));
create policy "insert cash" on public.cash_movements for insert to authenticated with check (can_write('caisse'));
create policy "update cash" on public.cash_movements for update to authenticated using (can_write('caisse')) with check (can_write('caisse'));
create policy "delete cash" on public.cash_movements for delete to authenticated using (can_write('caisse'));

create trigger a_num_cai before insert on public.cash_movements for each row execute function public.assign_doc_number('CAI');
create trigger a_keep_num before update on public.cash_movements for each row execute function public.keep_doc_number();
create trigger t_cash_movements_upd before update on public.cash_movements for each row execute function public.touch_updated_at();

-- 6. Module caisse dans les permissions serveur (ADMIN tout, COMPTABLE caisse)
create or replace function public.can_write(_module text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select public.is_active_user(auth.uid()) and exists (
    select 1 from public.user_roles r where r.user_id = auth.uid() and (
      r.role='ADMIN'
      or (r.role='RESPONSABLE_PRODUCTION' and _module in ('receptions','production','suppliers'))
      or (r.role='MAGASINIER' and _module in ('stock'))
      or (r.role='COMMERCIAL' and _module in ('customers','sales'))
      or (r.role='COMPTABLE' and _module in ('expenses','caisse'))
    ))
$$;

-- 7. Paiement de vente -> mouvement de caisse (sans doublon via dedupe_key)
create or replace function public.cash_on_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare ref text;
begin
  if tg_op = 'DELETE' then
    delete from public.cash_movements where dedupe_key = 'payment:' || old.id;
    return old;
  end if;
  select number into ref from public.sales where id = new.sale_id;
  ref := coalesce(ref, 'Vente');
  delete from public.cash_movements where dedupe_key = 'payment:' || new.id;
  if new.amount > 0 then
    insert into public.cash_movements(date, type, amount, source, motive, reference, user_id, created_by, dedupe_key)
    values (new.date, 'ENTREE', new.amount, 'Vente', 'Encaissement vente', ref, new.created_by, new.created_by, 'payment:' || new.id);
  elsif new.amount < 0 then
    insert into public.cash_movements(date, type, amount, source, motive, reference, user_id, created_by, dedupe_key)
    values (new.date, 'SORTIE', -new.amount, 'Remboursement', 'Correction paiement vente', ref, new.created_by, new.created_by, 'payment:' || new.id);
  end if;
  return new;
end $$;
create trigger t_cash_payment after insert or update or delete on public.payments for each row execute function public.cash_on_payment();

-- 8. Dépense -> sortie de caisse
create or replace function public.cash_on_expense()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.cash_movements where dedupe_key = 'expense:' || old.id;
    return old;
  end if;
  delete from public.cash_movements where dedupe_key = 'expense:' || new.id;
  insert into public.cash_movements(date, type, amount, source, motive, reference, user_id, created_by, dedupe_key)
  values (new.date, 'SORTIE', new.amount, 'Dépense — ' || new.category, new.description, new.number, new.user_id, new.created_by, 'expense:' || new.id);
  return new;
end $$;
create trigger t_cash_expense after insert or update or delete on public.expenses for each row execute function public.cash_on_expense();

-- 9. Paiement agriculteur (réception) -> sortie de caisse
create or replace function public.cash_on_reception()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.cash_movements where dedupe_key = 'reception:' || old.id;
    return old;
  end if;
  delete from public.cash_movements where dedupe_key = 'reception:' || new.id;
  if not new.cancelled and new.paid > 0 then
    insert into public.cash_movements(date, time, type, amount, source, motive, reference, user_id, created_by, dedupe_key)
    values (new.date, new.time, 'SORTIE', new.paid, 'Achat olives', 'Paiement agriculteur', new.number, new.created_by, new.created_by, 'reception:' || new.id);
  end if;
  return new;
end $$;
create trigger t_cash_reception after insert or update or delete on public.olive_receptions for each row execute function public.cash_on_reception();

-- 10. Production liée -> huile disponible pour les réceptions « transformation »
create or replace function public.sync_reception_transform()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare rid uuid;
begin
  rid := coalesce(new.reception_id, old.reception_id);
  if rid is null then return coalesce(new, old); end if;
  update public.olive_receptions r
  set transform_status = case
    when exists (select 1 from public.productions p where p.reception_id = rid) then 'HUILE_DISPONIBLE'
    else 'EN_ATTENTE' end
  where r.id = rid
    and r.client_choice in ('TRANSFORMATION_HUILE','MIXTE')
    and r.transform_status <> 'HUILE_RECUPEREE';
  return coalesce(new, old);
end $$;
create trigger t_rec_transform after insert or update or delete on public.productions for each row execute function public.sync_reception_transform();

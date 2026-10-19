
alter table public.sales add constraint sales_unit_price_check check (unit_price >= 0), add constraint sales_paid_check check (paid >= 0);
alter table public.olive_receptions add constraint rec_price_check check (price_per_kg >= 0);
alter table public.productions add constraint prod_byproducts_check check (byproducts_kg >= 0);
alter table public.stock_items add constraint stock_min_check check (min_quantity >= 0);

-- Keep stock consistent when a sale is edited or deleted
create or replace function public.on_sale_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'DELETE' then
    if old.item_id is not null then
      insert into public.stock_movements(item_id, quantity, type, user_id, reference)
      values (old.item_id, old.quantity, 'correction', auth.uid(), 'Annulation ' || old.number);
    end if;
    return old;
  end if;
  if new.item_id is distinct from old.item_id or new.quantity <> old.quantity then
    if old.item_id is not null then
      insert into public.stock_movements(item_id, quantity, type, user_id, reference)
      values (old.item_id, old.quantity, 'correction', auth.uid(), 'Modification ' || old.number);
    end if;
    if new.item_id is not null then
      insert into public.stock_movements(item_id, quantity, type, user_id, reference)
      values (new.item_id, -new.quantity, 'vente', auth.uid(), new.number);
    end if;
  end if;
  update public.sale_items set item_id = new.item_id, quantity = new.quantity, unit_price = new.unit_price, total = new.total where sale_id = new.id;
  if new.paid <> old.paid then
    insert into public.payments(sale_id, amount, mode, created_by) values (new.id, new.paid - old.paid, new.payment_mode, auth.uid());
  end if;
  return new;
end $$;
create trigger t_sale_change after update or delete on public.sales for each row execute function public.on_sale_change();

-- sale_items/payments cascade before sales delete trigger runs AFTER; fine.

-- Keep stock consistent when a production is edited or deleted
create or replace function public.on_production_change() returns trigger language plpgsql security definer set search_path=public as $$
declare bulk uuid; delta numeric;
begin
  select id into bulk from public.stock_items where category = 'Huile en vrac' order by created_at limit 1;
  if bulk is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    delta := -old.oil_liters;
    insert into public.stock_movements(item_id, quantity, type, user_id, reference)
    values (bulk, delta, 'correction', auth.uid(), 'Annulation ' || old.number);
    return old;
  end if;
  delta := new.oil_liters - old.oil_liters;
  if delta <> 0 then
    insert into public.stock_movements(item_id, quantity, type, user_id, reference)
    values (bulk, delta, 'correction', auth.uid(), 'Modification ' || new.number);
  end if;
  return new;
end $$;
create trigger t_prod_change after update or delete on public.productions for each row execute function public.on_production_change();

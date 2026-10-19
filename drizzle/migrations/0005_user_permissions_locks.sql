CREATE TABLE public.user_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  level text NOT NULL CHECK (level IN ('none','read','write')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "perm admin insert" ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'ADMIN') AND public.is_active_user(auth.uid()));
CREATE POLICY "perm admin update" ON public.user_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN')) WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "perm admin delete" ON public.user_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'));

CREATE OR REPLACE FUNCTION public.can_write(_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select public.is_active_user(auth.uid()) and (
    public.has_role(auth.uid(),'ADMIN')
    or coalesce(
      (select p.level = 'write' from public.user_permissions p where p.user_id = auth.uid() and p.module = _module),
      exists (select 1 from public.user_roles r where r.user_id = auth.uid() and (
        (r.role='RESPONSABLE_PRODUCTION' and _module in ('receptions','production','suppliers'))
        or (r.role='MAGASINIER' and _module in ('stock'))
        or (r.role='COMMERCIAL' and _module in ('customers','sales'))
        or (r.role='COMPTABLE' and _module in ('expenses','caisse'))
      ))
    )
  )
$$;

CREATE TABLE public.record_locks (
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  user_id uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, record_id)
);
GRANT SELECT ON public.record_locks TO authenticated;
GRANT ALL ON public.record_locks TO service_role;
ALTER TABLE public.record_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locks read" ON public.record_locks FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

-- Renvoie NULL si le verrou est obtenu, sinon le nom de la personne qui le détient.
CREATE OR REPLACE FUNCTION public.acquire_lock(_table text, _id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare holder uuid; who text;
begin
  if not public.is_active_user(auth.uid()) then raise exception 'Compte inactif.'; end if;
  delete from public.record_locks where locked_at < now() - interval '10 minutes';
  insert into public.record_locks(table_name, record_id, user_id) values (_table, _id, auth.uid())
  on conflict (table_name, record_id) do update set locked_at = now()
    where record_locks.user_id = auth.uid();
  select user_id into holder from public.record_locks where table_name=_table and record_id=_id;
  if holder = auth.uid() then return null; end if;
  select trim(first_name||' '||last_name) into who from public.profiles where id = holder;
  return coalesce(nullif(who,''), 'un autre utilisateur');
end $$;

CREATE OR REPLACE FUNCTION public.release_lock(_table text, _id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  delete from public.record_locks where table_name=_table and record_id=_id and user_id=auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.acquire_lock(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_lock(text, uuid) TO authenticated;

-- Exclusion mutuelle + séparation des tâches sur les opérations critiques.
CREATE OR REPLACE FUNCTION public.guard_critical()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare holder uuid; who text;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return case when tg_op='DELETE' then old else new end;
  end if;
  select user_id into holder from public.record_locks
   where table_name = tg_table_name and record_id = old.id and locked_at > now() - interval '10 minutes';
  if holder is not null and holder <> auth.uid() then
    select trim(first_name||' '||last_name) into who from public.profiles where id = holder;
    raise exception 'Fiche en cours de modification par %.', coalesce(nullif(who,''),'un autre utilisateur');
  end if;
  if tg_op = 'DELETE' and old.created_by = auth.uid() and not public.has_role(auth.uid(),'ADMIN') then
    raise exception 'Séparation des tâches : vous ne pouvez pas annuler une opération que vous avez créée.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

CREATE TRIGGER t_guard_sales BEFORE UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.guard_critical();
CREATE TRIGGER t_guard_cash BEFORE UPDATE OR DELETE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_critical();
CREATE TRIGGER t_guard_payments BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_critical();
CREATE TABLE public.doc_counters (
  prefix text NOT NULL,
  year int NOT NULL,
  last int NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);
GRANT ALL ON public.doc_counters TO service_role;
ALTER TABLE public.doc_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_doc_number(_prefix text, _date date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare y int := extract(year from coalesce(_date, current_date))::int; n int;
begin
  insert into public.doc_counters(prefix, year, last) values (_prefix, y, 1)
  on conflict (prefix, year) do update set last = public.doc_counters.last + 1
  returning last into n;
  return _prefix || '-' || y || '-' || lpad(n::text, 4, '0');
end $$;

CREATE OR REPLACE FUNCTION public.assign_doc_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  new.number := public.next_doc_number(tg_argv[0], new.date);
  return new;
end $$;

-- initialise counters from existing data
INSERT INTO public.doc_counters(prefix, year, last)
SELECT p, y, max(n) FROM (
  SELECT 'REC' p, extract(year from date)::int y, coalesce(nullif(regexp_replace(split_part(number,'-',3),'\D','','g'),''),'0')::int n FROM public.olive_receptions
  UNION ALL SELECT 'VTE', extract(year from date)::int, coalesce(nullif(regexp_replace(split_part(number,'-',3),'\D','','g'),''),'0')::int FROM public.sales
  UNION ALL SELECT 'PROD', extract(year from date)::int, coalesce(nullif(regexp_replace(split_part(number,'-',3),'\D','','g'),''),'0')::int FROM public.productions
  UNION ALL SELECT 'DEP', extract(year from date)::int, coalesce(nullif(regexp_replace(split_part(number,'-',3),'\D','','g'),''),'0')::int FROM public.expenses
) s GROUP BY p, y
ON CONFLICT (prefix, year) DO UPDATE SET last = greatest(public.doc_counters.last, excluded.last);

CREATE TRIGGER a_num_rec BEFORE INSERT ON public.olive_receptions FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('REC');
CREATE TRIGGER a_num_vte BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('VTE');
CREATE TRIGGER a_num_prod BEFORE INSERT ON public.productions FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('PROD');
CREATE TRIGGER a_num_dep BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('DEP');

-- numbers cannot be changed afterwards
CREATE OR REPLACE FUNCTION public.keep_doc_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin new.number := old.number; return new; end $$;
CREATE TRIGGER a_keep_num BEFORE UPDATE ON public.olive_receptions FOR EACH ROW EXECUTE FUNCTION public.keep_doc_number();
CREATE TRIGGER a_keep_num BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.keep_doc_number();
CREATE TRIGGER a_keep_num BEFORE UPDATE ON public.productions FOR EACH ROW EXECUTE FUNCTION public.keep_doc_number();
CREATE TRIGGER a_keep_num BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.keep_doc_number();

-- manual stock movements get an MVT reference when none is given
CREATE OR REPLACE FUNCTION public.assign_mvt_ref()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if coalesce(trim(new.reference), '') in ('', '—') then
    new.reference := public.next_doc_number('MVT', new.date);
  end if;
  return new;
end $$;
CREATE TRIGGER a_mvt_ref BEFORE INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.assign_mvt_ref();

ALTER TABLE public.settings ADD COLUMN last_backup_at timestamptz;
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Wallet, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDA, formatDate, formatDateTime } from "@/lib/format";
import { normalize } from "@/lib/text";
import { checkRepayment, customerDebt } from "@/lib/showroom-order";
import { cn } from "@/lib/utils";
import type { Customer, Sale } from "@/lib/types";

export interface CustomerPayment { id: string; number: string; customer_id: string; amount: number; mode: string; debt_before: number; debt_after: number; allocations: { sale: string; amount: number }[]; created_at: string }

export function useCustomerPayments(enabled: boolean) {
  const [rows, setRows] = useState<CustomerPayment[]>([]);
  const refresh = () => api.list<CustomerPayment>("customer_payments").then((r) => setRows(r.map((x) => ({ ...x, amount: Number(x.amount), debt_before: Number(x.debt_before), debt_after: Number(x.debt_after) })).sort((a, b) => b.created_at.localeCompare(a.created_at)))).catch(() => undefined);
  useEffect(() => { if (enabled) void refresh(); }, [enabled]);
  return { rows, refresh };
}

export function CustomerAccounts({ customers, sales, payments, onPaid, onNewCustomer }: {
  customers: Customer[]; sales: Sale[]; payments: CustomerPayment[]; onPaid: () => Promise<void> | void; onNewCustomer: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("espèces");
  const [busy, setBusy] = useState(false);
  const reqId = useRef<string | null>(null);

  const list = useMemo(() => customers.map((c) => {
    const own = sales.filter((s) => s.customerId === c.id);
    return { c, debt: customerDebt(sales, c.id), bought: own.reduce((s, x) => s + Number(x.total), 0), paid: own.reduce((s, x) => s + Number(x.paid), 0) };
  }).filter((r) => !q || normalize(`${r.c.name} ${r.c.company} ${r.c.phone}`).includes(normalize(q))).sort((a, b) => b.debt - a.debt || a.c.name.localeCompare(b.c.name, "fr")), [customers, sales, q]);
  const current = list.find((r) => r.c.id === sel) ?? null;
  const history = useMemo(() => sel ? sales.filter((s) => s.customerId === sel).sort((a, b) => b.date.localeCompare(a.date)) : [], [sales, sel]);
  const versements = payments.filter((p) => p.customer_id === sel);

  async function pay() {
    if (!current || busy) return;
    const value = Number(amount.replace(",", "."));
    const err = checkRepayment(current.debt, value);
    if (err) { toast.error(err); return; }
    setBusy(true);
    reqId.current ??= crypto.randomUUID();
    try {
      const r = await api.rpc<CustomerPayment>("record_customer_payment", { _id: reqId.current, _customer: current.c.id, _amount: value, _mode: mode });
      reqId.current = null;
      setAmount("");
      toast.success(`Versement ${r.number} enregistré — dette restante ${formatDA(Number(r.debt_after))}`);
      await onPaid();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Versement impossible"); }
    finally { setBusy(false); }
  }

  return <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[360px_1fr]">
    <section className="card-surface flex min-h-0 flex-col p-3">
      <div className="mb-2 flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, société, téléphone" className="pl-9" autoFocus /></div>
        <Button variant="outline" size="icon" onClick={onNewCustomer} aria-label="Nouveau client"><UserPlus className="h-4 w-4" /></Button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {list.map((r) => <button key={r.c.id} type="button" onClick={() => { setSel(r.c.id); reqId.current = null; }} className={cn("flex w-full items-center justify-between gap-2 rounded-lg border p-2.5 text-left text-sm transition hover:border-primary", sel === r.c.id ? "border-primary bg-primary/5" : "border-border")}>
          <span className="min-w-0"><span className="block truncate font-medium">{r.c.name}</span><span className="block truncate text-xs text-muted-foreground">{r.c.company || r.c.phone || "—"}</span></span>
          <span className={cn("whitespace-nowrap text-sm font-semibold", r.debt > 0 ? "text-destructive" : "text-muted-foreground")}>{formatDA(r.debt)}</span>
        </button>)}
        {!list.length && <p className="py-8 text-center text-sm text-muted-foreground">Aucun client.</p>}
      </div>
    </section>
    <section className="min-h-0 overflow-y-auto">
      {!current ? <div className="card-surface flex h-full items-center justify-center p-10 text-sm text-muted-foreground">Choisissez un client pour voir son compte.</div> : <div className="space-y-4">
        <div className="card-surface p-4">
          <h2 className="font-display text-xl font-semibold">{current.c.name}</h2>
          <p className="text-sm text-muted-foreground">{[current.c.company, current.c.phone, current.c.address, current.c.wilaya].filter(Boolean).join(" · ") || "Aucune coordonnée"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Stat label="Total des achats" value={formatDA(current.bought)} />
            <Stat label="Total payé" value={formatDA(current.paid)} />
            <Stat label="Dette globale" value={formatDA(current.debt)} strong={current.debt > 0} />
          </div>
        </div>
        <div className="card-surface p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4" /> Enregistrer un versement</h3>
          {current.debt <= 0 ? <p className="text-sm text-muted-foreground">Ce client n'a aucune dette.</p> : <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void pay(); }}>
            <Input className="h-12 w-48 text-lg" inputMode="decimal" placeholder="Montant versé" value={amount} onChange={(e) => { setAmount(e.target.value); reqId.current = null; }} aria-label="Montant versé" />
            <Button type="button" variant="outline" className="h-12" onClick={() => setAmount(String(current.debt))}>Tout ({formatDA(current.debt)})</Button>
            <select aria-label="Mode" className="h-12 rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="espèces">Cash</option><option value="TPE">TPE</option><option value="virement">Virement</option><option value="chèque">Chèque</option>
            </select>
            <Button type="submit" className="h-12 px-6" disabled={busy}>{busy ? "Enregistrement…" : "Valider le versement"}</Button>
            {amount && Number(amount.replace(",", ".")) > 0 && <span className="text-sm">Dette après : <b>{formatDA(Math.max(current.debt - Number(amount.replace(",", ".")), 0))}</b></span>}
          </form>}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card-surface p-4"><h3 className="mb-2 font-semibold">Historique des achats</h3>
            <div className="max-h-80 overflow-y-auto text-sm">{history.map((s) => <div key={s.id} className="flex justify-between gap-2 border-b border-border py-1.5"><span className="min-w-0 truncate">{formatDate(s.date)} · {s.number} <span className="text-muted-foreground">{s.notes}</span></span><span className="whitespace-nowrap">{formatDA(Number(s.total))}{Number(s.remaining) > 0 && <b className="ml-2 text-destructive">reste {formatDA(Number(s.remaining))}</b>}</span></div>)}{!history.length && <p className="text-muted-foreground">Aucun achat.</p>}</div>
          </div>
          <div className="card-surface p-4"><h3 className="mb-2 font-semibold">Historique des versements</h3>
            <div className="max-h-80 overflow-y-auto text-sm">{versements.map((p) => <div key={p.id} className="border-b border-border py-1.5"><div className="flex justify-between"><span>{formatDateTime(p.created_at)} · {p.number}</span><b>{formatDA(p.amount)}</b></div><p className="text-xs text-muted-foreground">{p.mode === "espèces" ? "Cash" : p.mode} · dette {formatDA(p.debt_before)} → {formatDA(p.debt_after)}</p></div>)}{!versements.length && <p className="text-muted-foreground">Aucun versement.</p>}</div>
          </div>
        </div>
      </div>}
    </section>
  </div>;
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("font-display text-xl font-semibold", strong && "text-destructive")}>{value}</p></div>;
}

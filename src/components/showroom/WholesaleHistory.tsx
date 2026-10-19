import { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDA, formatDateTime } from "@/lib/format";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { Sale } from "@/lib/types";
import type { CustomerPayment } from "./CustomerAccounts";

export interface ShowroomDoc { id: string; number: string; kind: "CADEAU" | "GROS"; created_at: string; data: { number: string; customer: string; customer_id?: string | null; total: number; paid: number; beneficiary?: string; motive?: string; lines: unknown[]; at: string; driver: string; mode: string } }

export function WholesaleHistory({ docs, sales, payments, onOpen }: { docs: ShowroomDoc[]; sales: Sale[]; payments: CustomerPayment[]; onOpen: (d: ShowroomDoc) => void }) {
  const [kind, setKind] = useState<"GROS" | "CADEAU">("GROS");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = useMemo(() => docs.filter((d) => d.kind === kind)
    .filter((d) => !q || normalize(`${d.number} ${d.data.customer} ${d.data.beneficiary ?? ""}`).includes(normalize(q)))
    .filter((d) => (!from || d.created_at.slice(0, 10) >= from) && (!to || d.created_at.slice(0, 10) <= to)), [docs, kind, q, from, to]);
  // Reste actuel du bon : somme des restes des ventes liées (versements ultérieurs inclus).
  const remainingOf = (num: string) => sales.filter((s) => s.notes === `Vente en gros ${num}`).reduce((t, s) => t + Number(s.remaining), 0);
  const paymentsOf = (num: string) => payments.filter((p) => p.allocations?.some((a) => sales.some((s) => s.number === a.sale && s.notes === `Vente en gros ${num}`)));

  return <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-border p-0.5">
        {(["GROS", "CADEAU"] as const).map((k) => <Button key={k} size="sm" variant={kind === k ? "default" : "ghost"} onClick={() => setKind(k)}>{k === "GROS" ? "Ventes en gros" : "Cadeaux"}</Button>)}
      </div>
      <div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de bon, client, bénéficiaire" className="pl-9" /></div>
      <label className="text-xs text-muted-foreground">Du <Input type="date" className="inline-flex w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs text-muted-foreground">Au <Input type="date" className="inline-flex w-40" value={to} onChange={(e) => setTo(e.target.value)} /></label>
    </div>
    <div className="card-surface min-h-0 flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr>
          <th className="p-2">N°</th><th className="p-2">Date</th><th className="p-2">{kind === "GROS" ? "Client" : "Bénéficiaire"}</th>
          {kind === "GROS" ? <><th className="p-2 text-right">Total</th><th className="p-2 text-right">Versé au départ</th><th className="p-2 text-right">Reste actuel</th><th className="p-2">Versements</th></> : <><th className="p-2">Motif</th><th className="p-2 text-right">Articles</th></>}
          <th className="p-2" />
        </tr></thead>
        <tbody>
          {rows.map((d) => { const rest = remainingOf(d.number); const vs = paymentsOf(d.number); return <tr key={d.id} className="border-t border-border">
            <td className="p-2 font-medium">{d.number}</td><td className="p-2">{formatDateTime(d.created_at)}</td>
            <td className="p-2">{kind === "GROS" ? d.data.customer : d.data.beneficiary || "—"}</td>
            {kind === "GROS" ? <>
              <td className="p-2 text-right">{formatDA(Number(d.data.total))}</td>
              <td className="p-2 text-right">{formatDA(Number(d.data.paid))}</td>
              <td className={cn("p-2 text-right font-semibold", rest > 0 ? "text-destructive" : "text-success")}>{formatDA(rest)}</td>
              <td className="p-2 text-xs text-muted-foreground">{vs.length ? vs.map((p) => p.number).join(", ") : "—"}</td>
            </> : <><td className="p-2">{d.data.motive || "—"}</td><td className="p-2 text-right">{d.data.lines.length}</td></>}
            <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => onOpen(d)}><Eye className="h-4 w-4" /> Consulter</Button></td>
          </tr>; })}
          {!rows.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun bon.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Plus, Trash2, Truck } from "lucide-react";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { selectClass } from "@/components/common/select-class";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { DELIVERY_LABELS, HANDOVER_LABELS, VMOV_LABELS, loadFleet, rpc, type FleetData, type Row } from "@/lib/fleet";
import { formatDA, formatDateTime, formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/flotte")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chauffeurs et livraisons — Medjadja Olive" },
      { name: "description", content: "Véhicules, chargements, livraisons, ventes chauffeurs et remises de caisse." },
      { property: "og:title", content: "Chauffeurs et livraisons — Medjadja Olive" },
      { property: "og:description", content: "Pilotage des tournées de livraison depuis le logiciel principal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell module="flotte">
      <FleetPage />
    </AppShell>
  ),
});

type Tab = "vehicles" | "load" | "deliveries" | "sales" | "stock" | "routes" | "prices";
const TABS: [Tab, string][] = [
  ["vehicles", "Véhicules"],
  ["load", "Chargement"],
  ["deliveries", "Livraisons"],
  ["sales", "Ventes chauffeurs"],
  ["stock", "Stock véhicules"],
  ["routes", "Tournées et remises"],
  ["prices", "Prix de vente"],
];

const EMPTY: FleetData = { vehicles: [], vstock: [], routes: [], vmov: [], deliveries: [], deliveryItems: [], sales: [], saleItems: [], cash: [] };

function FleetPage() {
  const { state, currentUser, resetDemo } = useApp();
  const [tab, setTab] = useState<Tab>("vehicles");
  const [data, setData] = useState<FleetData>(EMPTY);
  const refresh = useCallback(async () => setData(await loadFleet()), []);
  useEffect(() => void refresh(), [refresh]);
  const after = async () => {
    await refresh();
    resetDemo();
  };
  const role = currentUser?.role;
  const isManager = role === "ADMIN" || role === "MAGASINIER";
  const userName = (id?: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "—";
  };
  const itemName = (id: string) => state.stockItems.find((i) => i.id === id)?.name ?? "—";
  const custName = (id?: string) => (id ? state.customers.find((c) => c.id === id)?.name ?? "—" : "Client comptoir");
  const vehName = (id?: string) => data.vehicles.find((v) => v.id === id)?.name ?? "—";
  const ctx = { data, after, userName, itemName, custName, vehName, isManager, role };

  const toValidate = data.routes.filter((r) => r.status === "CLOTUREE" && r.handover_status !== "VALIDE");
  return (
    <>
      <PageHeader title="Chauffeurs et livraisons" subtitle="Véhicules, stock embarqué, livraisons, ventes directes et remises de caisse." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Véhicules actifs" value={String(data.vehicles.filter((v) => v.active).length)} icon={Truck} />
        <KpiCard label="Livraisons à faire" value={String(data.deliveries.filter((d) => ["A_LIVRER", "EN_COURS", "REPORTEE"].includes(d.status)).length)} icon={Truck} tone="gold" />
        <KpiCard label="Ventes chauffeurs (total)" value={formatDA(data.sales.reduce((a, s) => a + s.total, 0))} icon={Truck} tone="success" />
        <KpiCard label="Remises à valider" value={String(toValidate.length)} icon={CheckCircle2} tone="destructive" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([t, l]) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
            {l}
          </Button>
        ))}
      </div>
      {tab === "vehicles" && <Vehicles {...ctx} />}
      {tab === "load" && <Load {...ctx} />}
      {tab === "deliveries" && <Deliveries {...ctx} />}
      {tab === "sales" && <Sales {...ctx} />}
      {tab === "stock" && <VStock {...ctx} />}
      {tab === "routes" && <Routes {...ctx} />}
      {tab === "prices" && <Prices {...ctx} />}
    </>
  );
}

type Ctx = {
  data: FleetData;
  after: () => Promise<void>;
  userName: (id?: string) => string;
  itemName: (id: string) => string;
  custName: (id?: string) => string;
  vehName: (id?: string) => string;
  isManager: boolean;
  role?: string | undefined;
};

function Box({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card-surface p-5", className)}>{children}</div>;
}

function useDrivers() {
  const { state } = useApp();
  return state.users.filter((u) => u.role === "CHAUFFEUR" && u.active);
}

function Vehicles({ data, after, userName, isManager }: Ctx) {
  const drivers = useDrivers();
  const [f, setF] = useState({ name: "", plate: "", driver: "" });
  const save = async () => {
    if (!f.name.trim()) return void toast.error("Nom du véhicule obligatoire");
    try {
      await api.insert("vehicles", { name: f.name.trim(), plate: f.plate, driver_id: f.driver || null });
    } catch {
      return void toast.error("Opération impossible : vérifiez vos droits.");
    }
    toast.success("Véhicule ajouté");
    setF({ name: "", plate: "", driver: "" });
    await after();
  };
  const patch = async (id: string, p: Record<string, unknown>) => {
    try {
      await api.update("vehicles", id, p);
      await after();
    } catch {
      toast.error("Opération impossible.");
    }
  };
  return (
    <div className="space-y-4">
      {isManager && (
        <Box className="grid gap-3 sm:grid-cols-4">
          <Input placeholder="Nom (ex. Renault Master 01)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder="Matricule" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} />
          <select className={selectClass} value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })}>
            <option value="">Chauffeur…</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
          </select>
          <Button onClick={save}><Plus className="mr-1 h-4 w-4" /> Ajouter</Button>
          {!drivers.length && <p className="text-xs text-muted-foreground sm:col-span-4">Créez d'abord un utilisateur avec le rôle « Chauffeur » dans la page Utilisateurs.</p>}
        </Box>
      )}
      <Box className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Véhicule</TableHead><TableHead>Matricule</TableHead><TableHead>Chauffeur</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell>{v.plate || "—"}</TableCell>
                <TableCell>
                  {isManager ? (
                    <select className={selectClass} value={v.driver_id ?? ""} onChange={(e) => patch(v.id, { driver_id: e.target.value || null })}>
                      <option value="">—</option>
                      {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
                    </select>
                  ) : userName(v.driver_id)}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" disabled={!isManager} onClick={() => patch(v.id, { active: !v.active })}>
                    {v.active ? "Actif" : "Inactif"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!data.vehicles.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucun véhicule.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
    </div>
  );
}

function ItemLines({ lines, setLines, withPrice }: { lines: { item_id: string; qty: string; price: string }[]; setLines: (l: { item_id: string; qty: string; price: string }[]) => void; withPrice?: boolean }) {
  const { state } = useApp();
  const items = state.stockItems.filter((i) => i.category !== "Huile en vrac" || true);
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_100px_auto] gap-2 sm:grid-cols-[1fr_110px_130px_auto]">
          <select
            className={selectClass}
            value={l.item_id}
            onChange={(e) => {
              const it = state.stockItems.find((x) => x.id === e.target.value);
              const n = [...lines];
              n[i] = { ...l, item_id: e.target.value, price: String(it?.salePrice ?? 0) };
              setLines(n);
            }}
          >
            <option value="">Article…</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.name} (dépôt : {formatNumber(it.quantity)} {it.unit})</option>)}
          </select>
          <Input inputMode="decimal" placeholder="Qté" value={l.qty} onChange={(e) => { const n = [...lines]; n[i] = { ...l, qty: e.target.value }; setLines(n); }} />
          {withPrice && <Input inputMode="decimal" placeholder="Prix DA" value={l.price} onChange={(e) => { const n = [...lines]; n[i] = { ...l, price: e.target.value }; setLines(n); }} />}
          <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Retirer"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setLines([...lines, { item_id: "", qty: "", price: "" }])}><Plus className="mr-1 h-4 w-4" /> Ligne</Button>
    </div>
  );
}

const toItems = (lines: { item_id: string; qty: string; price: string }[]) =>
  lines.filter((l) => l.item_id && Number(l.qty) > 0).map((l) => ({ item_id: l.item_id, qty: Number(l.qty.replace(",", ".")), price: Number(l.price.replace(",", ".")) || 0 }));

function Load({ data, after, isManager, itemName, vehName, userName }: Ctx) {
  const [veh, setVeh] = useState("");
  const [lines, setLines] = useState([{ item_id: "", qty: "", price: "" }]);
  const loads = data.vmov.filter((m) => m.type === "CHARGEMENT");
  return (
    <div className="space-y-4">
      {isManager ? (
        <Box className="space-y-3">
          <select className={selectClass} value={veh} onChange={(e) => setVeh(e.target.value)}>
            <option value="">Véhicule…</option>
            {data.vehicles.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name} — {userName(v.driver_id)}</option>)}
          </select>
          <ItemLines lines={lines} setLines={setLines} />
          <Button
            onClick={async () => {
              const items = toItems(lines);
              if (!veh || !items.length) return void toast.error("Choisissez un véhicule et au moins un article");
              const num = await rpc<string>("fleet_load", { _vehicle: veh, _items: items });
              if (num) { toast.success(`Chargement ${num} validé`); setLines([{ item_id: "", qty: "", price: "" }]); await after(); }
            }}
          >
            Valider le chargement
          </Button>
          <p className="text-xs text-muted-foreground">Le stock principal diminue et le stock du véhicule augmente.</p>
        </Box>
      ) : <p className="text-sm text-muted-foreground">Chargement réservé au magasinier et à l'administrateur.</p>}
      <MovTable rows={loads} itemName={itemName} vehName={vehName} userName={userName} />
    </div>
  );
}

function MovTable({ rows, itemName, vehName, userName }: { rows: Row[]; itemName: (id: string) => string; vehName: (id?: string) => string; userName: (id?: string) => string }) {
  return (
    <Box className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>N°</TableHead><TableHead>Type</TableHead><TableHead>Véhicule</TableHead><TableHead>Article</TableHead><TableHead className="text-right">Qté</TableHead><TableHead>Par</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.slice(0, 200).map((m) => (
            <TableRow key={m.id}>
              <TableCell>{formatDateTime(m.created_at)}</TableCell>
              <TableCell>{m.number}</TableCell>
              <TableCell>{VMOV_LABELS[m.type] ?? m.type}</TableCell>
              <TableCell>{vehName(m.vehicle_id)}</TableCell>
              <TableCell>{itemName(m.item_id)}</TableCell>
              <TableCell className="text-right">{formatNumber(m.quantity)}</TableCell>
              <TableCell>{userName(m.created_by)}</TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Aucun mouvement.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Box>
  );
}

function Deliveries({ data, after, custName, vehName, userName, role, itemName }: Ctx) {
  const { state } = useApp();
  const canCreate = role === "ADMIN" || role === "MAGASINIER" || role === "COMMERCIAL";
  const [f, setF] = useState({ customer: "", vehicle: "", date: todayISO(), address: "", notes: "" });
  const [lines, setLines] = useState([{ item_id: "", qty: "", price: "" }]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {canCreate && (
        <Box className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <select className={selectClass} value={f.customer} onChange={(e) => { const c = state.customers.find((x) => x.id === e.target.value); setF({ ...f, customer: e.target.value, address: c?.address ?? f.address }); }}>
              <option value="">Client…</option>
              {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })}>
              <option value="">Véhicule / chauffeur…</option>
              {data.vehicles.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name} — {userName(v.driver_id)}</option>)}
            </select>
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Adresse de livraison" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            <Input placeholder="Note" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <ItemLines lines={lines} setLines={setLines} withPrice />
          <Button
            onClick={async () => {
              const items = toItems(lines);
              if (!f.customer || !f.vehicle || !items.length) return void toast.error("Client, véhicule et articles obligatoires");
              const num = await rpc<string>("create_delivery", { _customer: f.customer, _vehicle: f.vehicle, _date: f.date, _address: f.address, _notes: f.notes, _items: items });
              if (num) { toast.success(`Livraison ${num} créée`); setLines([{ item_id: "", qty: "", price: "" }]); setF({ ...f, customer: "", address: "", notes: "" }); await after(); }
            }}
          >
            Créer la livraison
          </Button>
        </Box>
      )}
      <Box className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Véhicule</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Payé</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.deliveries.map((d) => (
              <Fragment key={d.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === d.id ? null : d.id)}>
                  <TableCell className="font-medium">{d.number}</TableCell>
                  <TableCell>{d.date}</TableCell>
                  <TableCell>{custName(d.customer_id)}</TableCell>
                  <TableCell>{vehName(d.vehicle_id)}</TableCell>
                  <TableCell>{DELIVERY_LABELS[d.status]}</TableCell>
                  <TableCell className="text-right">{formatDA(d.total)}</TableCell>
                  <TableCell className="text-right">{formatDA(d.paid)}</TableCell>
                  <TableCell>
                    {canCreate && !["LIVREE", "ANNULEE"].includes(d.status) && (
                      <Button size="sm" variant="outline" onClick={async (e) => { e.stopPropagation(); if (!window.confirm("Annuler cette livraison ?")) return; const r = await rpc("set_delivery_status", { _id: d.id, _status: "ANNULEE", _notes: "" }); if (r) { toast.success("Livraison annulée"); await after(); } }}>Annuler</Button>
                    )}
                  </TableCell>
                </TableRow>
                {open === d.id && (
                  <TableRow key={d.id + "x"}>
                    <TableCell colSpan={8} className="bg-muted/40 text-sm">
                      {data.deliveryItems.filter((i) => i.delivery_id === d.id).map((i) => `${itemName(i.item_id)} × ${formatNumber(i.quantity)}`).join(" · ")}
                      {d.delivered_at && ` — livrée le ${formatDateTime(d.delivered_at)}`}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {!data.deliveries.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Aucune livraison.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
    </div>
  );
}

function Sales({ data, custName, userName, vehName, itemName }: Ctx) {
  return (
    <Box className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Date</TableHead><TableHead>Chauffeur</TableHead><TableHead>Véhicule</TableHead><TableHead>Client</TableHead><TableHead>Articles</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Payé</TableHead><TableHead className="text-right">Reste</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.sales.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.number}</TableCell>
              <TableCell>{formatDateTime(s.created_at)}</TableCell>
              <TableCell>{userName(s.driver_id)}</TableCell>
              <TableCell>{vehName(s.vehicle_id)}</TableCell>
              <TableCell>{custName(s.customer_id)}</TableCell>
              <TableCell className="text-xs">{data.saleItems.filter((i) => i.sale_id === s.id).map((i) => `${itemName(i.item_id)} × ${formatNumber(i.quantity)}`).join(", ")}</TableCell>
              <TableCell className="text-right">{formatDA(s.total)}</TableCell>
              <TableCell className="text-right">{formatDA(s.paid)} <span className="text-xs text-muted-foreground">{s.payment_mode}</span></TableCell>
              <TableCell className="text-right">{formatDA(s.remaining)}</TableCell>
            </TableRow>
          ))}
          {!data.sales.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucune vente chauffeur.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Box>
  );
}

function VStock({ data, itemName, userName, vehName }: Ctx) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {data.vehicles.map((v) => {
          const rows = data.vstock.filter((s) => s.vehicle_id === v.id && s.quantity > 0);
          return (
            <Box key={v.id}>
              <p className="font-semibold">{v.name} <span className="text-sm font-normal text-muted-foreground">— {userName(v.driver_id)}</span></p>
              <div className="mt-2 space-y-1 text-sm">
                {rows.map((s) => <div key={s.item_id} className="flex justify-between"><span>{itemName(s.item_id)}</span><span className="font-medium">{formatNumber(s.quantity)}</span></div>)}
                {!rows.length && <p className="text-muted-foreground">Vide</p>}
              </div>
            </Box>
          );
        })}
      </div>
      <h3 className="font-semibold">Tous les mouvements véhicules (retours, pertes, ventes…)</h3>
      <MovTable rows={data.vmov} itemName={itemName} vehName={vehName} userName={userName} />
    </div>
  );
}

function Routes({ data, after, userName, role }: Ctx) {
  const canValidate = role === "ADMIN" || role === "COMPTABLE";
  return (
    <Box className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead>Tournée</TableHead><TableHead>Chauffeur</TableHead><TableHead>Ouverte</TableHead><TableHead>Clôturée</TableHead><TableHead>Résumé</TableHead><TableHead className="text-right">Attendu</TableHead><TableHead className="text-right">Remis</TableHead><TableHead className="text-right">Écart</TableHead><TableHead>Remise</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.routes.map((r) => {
            const s = r.summary ?? {};
            const gap = r.cash_handed - r.cash_expected;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.number}</TableCell>
                <TableCell>{userName(r.driver_id)}</TableCell>
                <TableCell>{formatDateTime(r.opened_at)}</TableCell>
                <TableCell>{r.closed_at ? formatDateTime(r.closed_at) : "En cours"}</TableCell>
                <TableCell className="text-xs">
                  {r.status === "CLOTUREE"
                    ? `Chargé ${formatNumber(s.charge ?? 0)} · Livré ${formatNumber(s.livre ?? 0)} · Vendu ${formatNumber(s.vendu ?? 0)} · Retour ${formatNumber(s.retour ?? 0)} · Virement ${formatDA(Number(s.virement ?? 0))} · Crédit ${formatDA(Number(s.credit ?? 0))}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">{formatDA(r.cash_expected)}</TableCell>
                <TableCell className="text-right">{formatDA(r.cash_handed)}</TableCell>
                <TableCell className={cn("text-right", gap !== 0 && r.status === "CLOTUREE" && "text-destructive")}>{r.status === "CLOTUREE" ? formatDA(gap) : "—"}</TableCell>
                <TableCell>
                  {r.status === "CLOTUREE" && r.handover_status !== "VALIDE" && canValidate ? (
                    <Button size="sm" onClick={async () => { const ok = await rpc("validate_route", { _id: r.id }); if (ok) { toast.success("Remise validée, caisse mise à jour"); await after(); } }}>Valider</Button>
                  ) : r.status === "CLOTUREE" ? HANDOVER_LABELS[r.handover_status] : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {!data.routes.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucune tournée.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Box>
  );
}

function Prices({ isManager, after }: Ctx) {
  const { state, canEdit } = useApp();
  const can = isManager || canEdit("stock");
  const [vals, setVals] = useState<Record<string, string>>({});
  const items = state.stockItems.filter((i) => i.category !== "Huile en vrac");
  return (
    <Box className="space-y-2">
      <p className="text-sm text-muted-foreground">Prix utilisés par la vente directe des chauffeurs.</p>
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-3">
          <span className="flex-1 text-sm">{i.name}</span>
          <Input className="w-32" inputMode="decimal" disabled={!can} value={vals[i.id] ?? String(i.salePrice ?? 0)} onChange={(e) => setVals({ ...vals, [i.id]: e.target.value })} />
          <span className="text-xs text-muted-foreground">DA</span>
        </div>
      ))}
      {can && (
        <Button
          onClick={async () => {
            for (const [id, v] of Object.entries(vals)) {
              try {
                await api.update("stock_items", id, { sale_price: Number(v.replace(",", ".")) || 0 });
              } catch {
                return void toast.error("Opération impossible : vérifiez vos droits.");
              }
            }
            toast.success("Prix enregistrés");
            setVals({});
            await after();
          }}
        >
          Enregistrer les prix
        </Button>
      )}
    </Box>
  );
}

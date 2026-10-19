import { createFileRoute } from "@tanstack/react-router";
import {
  Coins,
  Download,
  Droplets,
  Gauge,
  Package,
  Printer,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { selectClass } from "@/components/common/select-class";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/context/AppContext";
import { daysAgoISO, formatDA, formatDate, formatNumber, todayISO } from "@/lib/format";

export const Route = createFileRoute("/rapports")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Rapports — Medjadja Olive" },
      {
        name: "description",
        content: "Rapports de production, ventes, finances et stock avec filtres par période.",
      },
      { property: "og:title", content: "Rapports — Medjadja Olive" },
      { property: "og:description", content: "Analyse de l'activité de l'unité d'huile d'olive." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { state } = useApp();
  const [period, setPeriod] = useState("mois");
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  const range = useMemo(() => {
    if (period === "jour") return { from: todayISO(), to: todayISO() };
    if (period === "semaine") return { from: daysAgoISO(7), to: todayISO() };
    if (period === "mois") return { from: daysAgoISO(30), to: todayISO() };
    return { from, to };
  }, [period, from, to]);

  const inRange = (d: string) => d >= range.from && d <= range.to;

  const receptions = state.receptions.filter((r) => inRange(r.date));
  const productions = state.productions.filter((p) => inRange(p.date));
  const sales = state.sales.filter((s) => inRange(s.date));
  const expenses = state.expenses.filter((e) => inRange(e.date));

  const olives = receptions.reduce((s, r) => s + r.weightKg, 0);
  const oil = productions.reduce((s, p) => s + p.oilLiters, 0);
  const pressed = productions.reduce((s, p) => s + p.olivesKg, 0);
  const avgYield = pressed > 0 ? (oil / pressed) * 100 : 0;
  const ca = sales.reduce((s, v) => s + v.total, 0);
  const received = sales.reduce((s, v) => s + v.paid, 0);
  const charges = expenses.reduce((s, e) => s + e.amount, 0);

  const byDay = useMemo(() => {
    const map = new Map<string, { oil: number; ca: number }>();
    productions.forEach((p) => {
      const cur = map.get(p.date) ?? { oil: 0, ca: 0 };
      map.set(p.date, { ...cur, oil: cur.oil + p.oilLiters });
    });
    sales.forEach((s) => {
      const cur = map.get(s.date) ?? { oil: 0, ca: 0 };
      map.set(s.date, { ...cur, ca: cur.ca + s.total });
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [productions, sales]);

  const bySupplier = useMemo(
    () =>
      state.suppliers
        .map((s) => {
          const recs = receptions.filter((r) => r.supplierId === s.id);
          const prods = productions.filter((p) =>
            recs.some((r) => r.id === p.receptionId),
          );
          const kg = recs.reduce((a, r) => a + r.weightKg, 0);
          const litres = prods.reduce((a, p) => a + p.oilLiters, 0);
          const pressedKg = prods.reduce((a, p) => a + p.olivesKg, 0);
          return {
            name: s.name,
            kg,
            litres,
            yieldPct: pressedKg > 0 ? (litres / pressedKg) * 100 : 0,
          };
        })
        .filter((r) => r.kg > 0),
    [state.suppliers, receptions, productions],
  );

  const byCustomer = useMemo(
    () =>
      state.customers
        .map((c) => {
          const rows = sales.filter((s) => s.customerId === c.id);
          return {
            name: c.name,
            count: rows.length,
            qty: rows.reduce((a, s) => a + s.quantity, 0),
            total: rows.reduce((a, s) => a + s.total, 0),
            due: rows.reduce((a, s) => a + s.remaining, 0),
          };
        })
        .filter((r) => r.count > 0),
    [state.customers, sales],
  );

  function exportCsv() {
    const lines = [
      ["Rapport", state.settings.companyName],
      ["Période", `${formatDate(range.from)} au ${formatDate(range.to)}`],
      [],
      ["Indicateur", "Valeur"],
      ["Olives reçues (kg)", olives],
      ["Huile produite (L)", oil],
      ["Rendement moyen (%)", avgYield.toFixed(2)],
      ["Chiffre d'affaires (DA)", ca],
      ["Encaissé (DA)", received],
      ["Dépenses (DA)", charges],
      ["Bénéfice estimé (DA)", ca - charges],
    ];
    const csv = lines.map((l) => l.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export Excel (CSV) téléchargé");
  }

  return (
    <AppShell module="reports">
      <PageHeader
        title="Rapports"
        subtitle={`Période du ${formatDate(range.from)} au ${formatDate(range.to)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer / PDF
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> Export Excel
            </Button>
          </>
        }
      />

      <div className="card-surface mb-6 grid gap-3 p-4 sm:grid-cols-3">
        <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="jour">Aujourd'hui</option>
          <option value="semaine">7 derniers jours</option>
          <option value="mois">30 derniers jours</option>
          <option value="personnalise">Période personnalisée</option>
        </select>
        <Input
          type="date"
          value={from}
          disabled={period !== "personnalise"}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          type="date"
          value={to}
          disabled={period !== "personnalise"}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <Tabs defaultValue="production">
        <TabsList>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard icon={Package} label="Olives reçues" value={`${formatNumber(olives, 0)} kg`} tone="primary" />
            <KpiCard icon={Droplets} label="Huile produite" value={`${formatNumber(oil, 0)} L`} tone="gold" />
            <KpiCard icon={Gauge} label="Rendement moyen" value={`${formatNumber(avgYield, 2)} %`} tone="success" />
          </div>
          <div className="card-surface overflow-hidden">
            <h3 className="border-b border-border p-4 font-display font-semibold">Par fournisseur</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="text-right">Olives</TableHead>
                    <TableHead className="text-right">Huile</TableHead>
                    <TableHead className="text-right">Rendement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySupplier.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.kg, 0)} kg</TableCell>
                      <TableCell className="text-right">{formatNumber(r.litres, 0)} L</TableCell>
                      <TableCell className="text-right">{formatNumber(r.yieldPct, 2)} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="card-surface overflow-hidden">
            <h3 className="border-b border-border p-4 font-display font-semibold">Par jour</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Huile produite</TableHead>
                    <TableHead className="text-right">Ventes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byDay.map(([date, v]) => (
                    <TableRow key={date}>
                      <TableCell>{formatDate(date)}</TableCell>
                      <TableCell className="text-right">{formatNumber(v.oil, 0)} L</TableCell>
                      <TableCell className="text-right">{formatDA(v.ca)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ventes" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard icon={TrendingUp} label="Chiffre d'affaires" value={formatDA(ca)} tone="primary" />
            <KpiCard
              icon={Droplets}
              label="Quantité vendue"
              value={`${formatNumber(sales.reduce((s, v) => s + v.quantity, 0), 0)} L`}
              tone="gold"
            />
            <KpiCard icon={ShoppingCart} label="Nombre de ventes" value={String(sales.length)} tone="success" />
          </div>
          <div className="card-surface overflow-hidden">
            <h3 className="border-b border-border p-4 font-display font-semibold">Par client</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Ventes</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Reste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCustomer.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.qty, 0)}</TableCell>
                      <TableCell className="text-right">{formatDA(r.total)}</TableCell>
                      <TableCell className="text-right">{formatDA(r.due)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finances" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <KpiCard icon={Coins} label="Recettes (facturé)" value={formatDA(ca)} tone="primary" />
            <KpiCard icon={Wallet} label="Encaissé" value={formatDA(received)} tone="success" />
            <KpiCard icon={Receipt} label="Dépenses" value={formatDA(charges)} tone="destructive" />
            <KpiCard icon={TrendingUp} label="Bénéfice estimé" value={formatDA(ca - charges)} tone="gold" />
          </div>
          <div className="card-surface overflow-hidden">
            <h3 className="border-b border-border p-4 font-display font-semibold">
              Dépenses par catégorie
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Part</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...new Set(expenses.map((e) => e.category))].map((cat) => {
                    const amount = expenses
                      .filter((e) => e.category === cat)
                      .reduce((s, e) => s + e.amount, 0);
                    return (
                      <TableRow key={cat}>
                        <TableCell>{cat}</TableCell>
                        <TableCell className="text-right">{formatDA(amount)}</TableCell>
                        <TableCell className="text-right">
                          {charges > 0 ? formatNumber((amount / charges) * 100, 1) : 0} %
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          <div className="card-surface overflow-hidden">
            <h3 className="border-b border-border p-4 font-display font-semibold">Stock actuel</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.stockItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.name}</TableCell>
                      <TableCell>{i.category}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(i.quantity, 0)} {i.unit}
                      </TableCell>
                      <TableCell>
                        {i.quantity <= i.minQuantity ? (
                          <StatusBadge tone="danger">STOCK FAIBLE</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">OK</StatusBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

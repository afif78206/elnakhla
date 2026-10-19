import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Droplets,
  Gauge,
  Leaf,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Weight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/common/KpiCard";
import { PageHeader } from "@/components/common/PageHeader";
import { useApp } from "@/context/AppContext";
import { daysAgoISO, formatDA, formatDate, formatDateTime, formatNumber, todayISO } from "@/lib/format";

export const Route = createFileRoute("/tableau-de-bord")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Tableau de bord — Medjadja Olive" },
      {
        name: "description",
        content: "Indicateurs du jour : olives reçues, huile produite, rendement, ventes et dépenses.",
      },
      { property: "og:title", content: "Tableau de bord — Medjadja Olive" },
      { property: "og:description", content: "Suivi quotidien de l'activité de l'huilerie." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { state } = useApp();
  const today = todayISO();

  const olivesToday = state.receptions
    .filter((r) => r.date === today)
    .reduce((s, r) => s + r.weightKg, 0);
  const oilToday = state.productions
    .filter((p) => p.date === today)
    .reduce((s, p) => s + p.oilLiters, 0);
  const avgYield = state.productions.length
    ? state.productions.reduce((s, p) => s + p.yieldPct, 0) / state.productions.length
    : 0;
  const oilStock = state.stockItems
    .filter((i) => i.category === "Huile en vrac")
    .reduce((s, i) => s + i.quantity, 0);
  const salesToday = state.sales.filter((s) => s.date === today);
  const revenueToday = salesToday.reduce((s, v) => s + v.total, 0);
  const expensesToday = state.expenses
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.amount, 0);

  const chartData = Array.from({ length: 7 }, (_, idx) => {
    const date = daysAgoISO(6 - idx);
    return {
      day: formatDate(date).slice(0, 5),
      huile: state.productions.filter((p) => p.date === date).reduce((s, p) => s + p.oilLiters, 0),
      ventes: state.sales.filter((v) => v.date === date).reduce((s, v) => s + v.total / 1000, 0),
    };
  });

  const activity = state.logs.slice(0, 8);
  const userName = (id: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "Système";
  };

  return (
    <AppShell module="dashboard">
      <PageHeader
        title="Tableau de bord"
        subtitle={`Activité du ${formatDate(today)} — ${state.settings.companyName}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Olives reçues aujourd'hui"
          value={`${formatNumber(olivesToday, 0)} kg`}
          icon={Weight}
        />
        <KpiCard
          label="Huile produite aujourd'hui"
          value={`${formatNumber(oilToday, 0)} L`}
          icon={Droplets}
          tone="gold"
        />
        <KpiCard
          label="Rendement moyen"
          value={`${formatNumber(avgYield, 2)} %`}
          icon={Gauge}
          tone="success"
        />
        <KpiCard
          label="Stock d'huile"
          value={`${formatNumber(oilStock, 0)} L`}
          icon={Boxes}
          hint="Toutes cuves confondues"
        />
        <KpiCard label="Ventes du jour" value={formatDA(revenueToday)} icon={ShoppingCart} />
        <KpiCard
          label="Dépenses du jour"
          value={formatDA(expensesToday)}
          icon={Wallet}
          tone="destructive"
        />
        <KpiCard
          label="Bénéfice estimé"
          value={formatDA(revenueToday - expensesToday)}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Nombre de ventes"
          value={`${salesToday.length}`}
          icon={Receipt}
          hint={`${state.sales.length} ventes au total`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold">Production et ventes — 7 jours</h2>
              <p className="text-xs text-muted-foreground">
                Huile produite (L) et ventes (milliers de DA)
              </p>
            </div>
            <Leaf className="h-5 w-5 text-primary" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gOil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="huile"
                  stroke="var(--color-primary)"
                  fill="url(#gOil)"
                  strokeWidth={2}
                  name="Huile (L)"
                />
                <Area
                  type="monotone"
                  dataKey="ventes"
                  stroke="var(--color-gold)"
                  fill="url(#gSales)"
                  strokeWidth={2}
                  name="Ventes (kDA)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="font-display text-base font-semibold">Dernières opérations</h2>
          <ul className="mt-4 space-y-3">
            {activity.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{userName(item.userId)}</span> {item.action}{" "}
                    <span className="text-muted-foreground">{item.reference}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Fournisseurs" value={`${state.suppliers.length}`} icon={Leaf} />
        <KpiCard label="Clients" value={`${state.customers.length}`} icon={Users} tone="gold" />
        <KpiCard
          label="Articles en stock faible"
          value={`${state.stockItems.filter((i) => i.quantity < i.minQuantity).length}`}
          icon={Boxes}
          tone="destructive"
        />
      </div>
    </AppShell>
  );
}

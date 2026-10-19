import { logoUrl } from "@/lib/brand";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  History,
  Home,
  LogOut,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  ShoppingCart,
  Truck,
  Users,
  Lock,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TicketContent, TicketPrintPortal, printTicket, type TicketData } from "@/components/fleet/Ticket80";
import {
  DELIVERY_LABELS,
  HANDOVER_LABELS,
  PAY_MODES,
  VMOV_LABELS,
  isToday,
  loadFleet,
  rpc,
  type FleetData,
  type Row,
} from "@/lib/fleet";
import { formatDA, formatDateTime, formatNumber } from "@/lib/format";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chauffeur")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Espace chauffeur — Medjadja Olive" },
      { name: "description", content: "Livraisons, vente directe, encaissements et clôture de tournée pour les chauffeurs." },
      { property: "og:title", content: "Espace chauffeur — Medjadja Olive" },
      { property: "og:description", content: "Application tactile des chauffeurs-livreurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverApp,
});

type View = "home" | "deliveries" | "sale" | "clients" | "stock" | "cash" | "returns" | "history" | "close";

const EMPTY: FleetData = {
  vehicles: [], vstock: [], routes: [], vmov: [], deliveries: [], deliveryItems: [], sales: [], saleItems: [], cash: [],
};

function DriverApp() {
  const { currentUser, ready, logout, state, resetDemo } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<FleetData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketData | null>(null);

  const refresh = useCallback(async () => {
    setData(await loadFleet());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (currentUser) void refresh();
  }, [currentUser, refresh]);

  if (!ready) return <Spinner />;
  if (!currentUser) {
    return (
      <Center>
        <p className="text-muted-foreground">Veuillez vous connecter.</p>
        <Button size="lg" onClick={() => navigate({ to: "/" })}>Connexion</Button>
      </Center>
    );
  }
  if (currentUser.role !== "CHAUFFEUR") {
    return (
      <Center>
        <p className="text-muted-foreground">Cet espace est réservé aux chauffeurs.</p>
        <Button size="lg" onClick={() => navigate({ to: "/flotte" })}>Gestion des chauffeurs</Button>
      </Center>
    );
  }

  const vehicle = data.vehicles[0];
  const itemName = (id: string) => state.stockItems.find((i) => i.id === id)?.name ?? "Article";
  const custName = (id?: string) => (id ? state.customers.find((c) => c.id === id)?.name ?? "—" : "Client comptoir");
  const route = data.routes.find((r) => r.status === "OUVERTE");
  const driverName = `${currentUser.firstName} ${currentUser.lastName}`;

  const after = async () => {
    await refresh();
    resetDemo();
  };

  const showTicket = (t: TicketData) => {
    setTicket(t);
  };

  const ctx: Ctx = { data, vehicle, itemName, custName, route, driverName, after, showTicket, setView };

  const titles: Record<View, string> = {
    home: "Accueil",
    deliveries: "Mes livraisons",
    sale: "Vente directe",
    clients: "Clients",
    stock: "Stock véhicule",
    cash: "Encaissements",
    returns: "Retours dépôt",
    history: "Historique",
    close: "Clôture tournée",
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        {view !== "home" ? (
          <button className="rounded-lg p-2" onClick={() => setView("home")} aria-label="Retour">
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : (
          <img src={logoUrl} alt="Logo Medjadja Olive" className="h-12 w-12 shrink-0 object-contain" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{view === "home" ? state.settings.companyName : titles[view]}</p>
          <p className="truncate text-xs opacity-80">
            {driverName} · {vehicle ? vehicle.name : "Aucun véhicule"}
            {route ? ` · ${route.number}` : ""}
          </p>
        </div>
        <button
          className="rounded-lg p-2"
          aria-label="Déconnexion"
          onClick={() => {
            logout();
            navigate({ to: "/", replace: true });
          }}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl p-4">
        {loading ? (
          <Spinner />
        ) : !vehicle ? (
          <Center>
            <Truck className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun véhicule ne vous est affecté. Contactez le responsable.</p>
          </Center>
        ) : (
          <>
            {view === "home" && <HomeView {...ctx} />}
            {view === "deliveries" && <DeliveriesView {...ctx} />}
            {view === "sale" && <SaleView {...ctx} />}
            {view === "clients" && <ClientsView {...ctx} />}
            {view === "stock" && <StockView {...ctx} />}
            {view === "cash" && <CashView {...ctx} />}
            {view === "returns" && <ReturnsView {...ctx} />}
            {view === "history" && <HistoryView {...ctx} />}
            {view === "close" && <CloseView {...ctx} />}
          </>
        )}
      </main>

      {view !== "home" && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card">
          {(
            [
              ["home", Home, "Accueil"],
              ["deliveries", ClipboardList, "Livraisons"],
              ["sale", ShoppingCart, "Vente"],
              ["stock", Boxes, "Stock"],
            ] as const
          ).map(([v, Icon, l]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("flex flex-col items-center gap-1 py-3 text-xs", view === v ? "text-primary" : "text-muted-foreground")}
            >
              <Icon className="h-6 w-6" />
              {l}
            </button>
          ))}
        </nav>
      )}

      {ticket && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 sm:items-center" onClick={() => setTicket(null)}>
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-lg border border-border">
              <TicketContent t={ticket} settings={state.settings} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button size="lg" variant="outline" className="h-14" onClick={() => setTicket(null)}>Fermer</Button>
              <Button size="lg" className="h-14" onClick={printTicket}>
                <Printer className="mr-2 h-5 w-5" /> Imprimer
              </Button>
            </div>
          </div>
        </div>
      )}
      <TicketPrintPortal t={ticket} settings={state.settings} />
    </div>
  );
}

interface Ctx {
  data: FleetData;
  vehicle: Row | undefined;
  itemName: (id: string) => string;
  custName: (id?: string) => string;
  route: Row | undefined;
  driverName: string;
  after: () => Promise<void>;
  showTicket: (t: TicketData) => void;
  setView: (v: View) => void;
}

function Spinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>;
}
function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card-surface p-4", className)}>{children}</div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </Card>
  );
}

/* ---------- Accueil ---------- */
function HomeView({ data, route, setView }: Ctx) {
  const today = data.deliveries.filter((d) => isToday(d.date) || (d.status !== "LIVREE" && d.status !== "ANNULEE"));
  const done = today.filter((d) => d.status === "LIVREE").length;
  const salesToday = data.sales.filter((s) => isToday(s.created_at));
  const cashRoute = data.cash.filter((c) => route && c.route_id === route.id && c.mode !== "crédit");
  const stockUnits = data.vstock.reduce((a, s) => a + s.quantity, 0);
  const tiles: [View, typeof Truck, string][] = [
    ["deliveries", ClipboardList, "Livraisons"],
    ["sale", ShoppingCart, "Vente directe"],
    ["stock", Boxes, "Stock véhicule"],
    ["cash", Banknote, "Encaissements"],
    ["clients", Users, "Clients"],
    ["returns", RotateCcw, "Retours dépôt"],
    ["history", History, "Historique"],
    ["close", Lock, "Clôture tournée"],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Livraisons aujourd'hui" value={String(today.length)} />
        <Stat label="Restantes" value={String(today.filter((d) => !["LIVREE", "ANNULEE"].includes(d.status)).length)} />
        <Stat label="Terminées" value={String(done)} />
        <Stat label="Ventes directes du jour" value={String(salesToday.length)} />
        <Stat label="Encaissé (tournée)" value={formatDA(cashRoute.reduce((a, c) => a + c.amount, 0))} />
        <Stat label="Stock véhicule" value={`${formatNumber(stockUnits)} u.`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(([v, Icon, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground shadow-sm transition active:scale-95"
          >
            <Icon className="h-8 w-8" />
            <span className="text-base font-semibold">{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Livraisons ---------- */
function DeliveriesView({ data, custName, itemName, after, showTicket, driverName, vehicle }: Ctx) {
  const [open, setOpen] = useState<string | null>(null);
  const [paid, setPaid] = useState("");
  const [mode, setMode] = useState<string>("espèces");
  const list = data.deliveries.filter((d) => d.status !== "ANNULEE");
  const sorted = [...list].sort((a, b) => Number(a.status === "LIVREE") - Number(b.status === "LIVREE"));

  if (!sorted.length) return <Center><p className="text-muted-foreground">Aucune livraison affectée.</p></Center>;

  return (
    <div className="space-y-3">
      {sorted.map((d) => {
        const items = data.deliveryItems.filter((i) => i.delivery_id === d.id);
        const isOpen = open === d.id;
        const ticketOf = (): TicketData => ({
          title: "BON DE LIVRAISON",
          number: d.number,
          at: d.delivered_at ?? d.created_at,
          driver: driverName,
          vehicle: vehicle?.name ?? "",
          customer: custName(d.customer_id),
          lines: items.map((i) => ({ name: itemName(i.item_id), qty: i.quantity, price: i.unit_price })),
          total: d.total,
          paid: d.paid,
          mode: d.payment_mode,
        });
        return (
          <Card key={d.id}>
            <button className="w-full text-left" onClick={() => { setOpen(isOpen ? null : d.id); setPaid(String(d.total)); }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{custName(d.customer_id)}</p>
                  <p className="text-sm text-muted-foreground">{d.number} · {d.address || "—"}</p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-xs font-medium", d.status === "LIVREE" ? "bg-success/15 text-success" : d.status === "ECHEC" ? "bg-destructive/12 text-destructive" : "bg-gold/20 text-gold-foreground")}>
                  {DELIVERY_LABELS[d.status]}
                </span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold">{formatDA(d.total)}</p>
            </button>
            {isOpen && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                {items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span>{itemName(i.item_id)}</span>
                    <span>{formatNumber(i.quantity)} × {formatDA(i.unit_price)}</span>
                  </div>
                ))}
                {d.notes && <p className="text-sm text-muted-foreground">Note : {d.notes}</p>}
                {d.status === "LIVREE" ? (
                  <Button size="lg" variant="outline" className="h-14 w-full" onClick={() => showTicket(ticketOf())}>
                    <Printer className="mr-2 h-5 w-5" /> Réimprimer le bon
                  </Button>
                ) : (
                  <>
                    <label className="block text-sm font-medium">Montant encaissé (DA)</label>
                    <Input inputMode="decimal" className="h-14 text-lg" value={paid} onChange={(e) => setPaid(e.target.value)} />
                    <ModePicker mode={mode} setMode={setMode} />
                    <Button
                      size="lg"
                      className="h-16 w-full text-lg"
                      onClick={async () => {
                        const p = Number(paid.replace(",", ".")) || 0;
                        const r = await rpc<string>("complete_delivery", { _id: d.id, _paid: p, _mode: mode });
                        if (!r) return;
                        toast.success(`Livraison ${d.number} validée`);
                        showTicket({ ...ticketOf(), paid: p, mode, at: new Date().toISOString() });
                        await after();
                      }}
                    >
                      <CheckCircle2 className="mr-2 h-6 w-6" /> Valider la livraison
                    </Button>
                    <div className="grid grid-cols-3 gap-2">
                      {(["EN_COURS", "REPORTEE", "ECHEC"] as const).map((s) => (
                        <Button
                          key={s}
                          variant="outline"
                          className="h-12"
                          onClick={async () => {
                            const r = await rpc("set_delivery_status", { _id: d.id, _status: s, _notes: "" });
                            if (r) { toast.success(DELIVERY_LABELS[s]); await after(); }
                          }}
                        >
                          {DELIVERY_LABELS[s]}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ModePicker({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PAY_MODES.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn("h-12 rounded-xl border text-sm font-medium capitalize", mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/* ---------- Vente directe / POS ---------- */
function SaleView({ data, itemName, custName, after, showTicket, driverName, vehicle }: Ctx) {
  const { state } = useApp();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState("");
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"cart" | "pay">("cart");
  const [paid, setPaid] = useState("");
  const [mode, setMode] = useState("espèces");

  const stock = data.vstock.filter((s) => s.quantity > 0);
  const price = (id: string) => Number((state.stockItems.find((i) => i.id === id) as any)?.salePrice ?? 0);
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const total = lines.reduce((a, [id, q]) => a + q * price(id), 0);
  const avail = (id: string) => stock.find((s) => s.item_id === id)?.quantity ?? 0;

  const add = (id: string, d: number) =>
    setCart((c) => {
      const n = Math.max(0, Math.min(avail(id), (c[id] ?? 0) + d));
      if ((c[id] ?? 0) + d > avail(id)) toast.error("Stock véhicule insuffisant");
      return { ...c, [id]: n };
    });

  const customers = useMemo(() => {
    const s = normalize(search);
    return state.customers.filter((c) => !s || normalize(`${c.name} ${c.phone}`).includes(s)).slice(0, 8);
  }, [state.customers, search]);

  if (!stock.length && !lines.length) return <Center><p className="text-muted-foreground">Le véhicule est vide. Demandez un chargement.</p></Center>;

  if (step === "pay") {
    const p = paid === "" ? total : Number(paid.replace(",", ".")) || 0;
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-sm text-muted-foreground">Total à payer</p>
          <p className="font-display text-3xl font-semibold">{formatDA(total)}</p>
        </Card>
        <Card className="space-y-2">
          <p className="text-sm font-medium">Client {p < total ? "(obligatoire pour un crédit)" : "(facultatif)"}</p>
          <Input className="h-12" placeholder="Rechercher nom ou téléphone" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="grid gap-2">
            <button onClick={() => setCustomer("")} className={cn("rounded-xl border p-3 text-left", !customer ? "border-primary bg-primary/10" : "border-border")}>
              Client comptoir
            </button>
            {customers.map((c) => (
              <button key={c.id} onClick={() => setCustomer(c.id)} className={cn("rounded-xl border p-3 text-left", customer === c.id ? "border-primary bg-primary/10" : "border-border")}>
                {c.name} <span className="text-sm text-muted-foreground">{c.phone}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="space-y-3">
          <label className="block text-sm font-medium">Montant reçu (DA)</label>
          <Input inputMode="decimal" className="h-14 text-lg" placeholder={String(total)} value={paid} onChange={(e) => setPaid(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-12" onClick={() => setPaid(String(total))}>Tout payé</Button>
            <Button variant="outline" className="h-12" onClick={() => setPaid(String(Math.round(total / 2)))}>Moitié</Button>
            <Button variant="outline" className="h-12" onClick={() => setPaid("0")}>Crédit</Button>
          </div>
          <ModePicker mode={mode} setMode={setMode} />
          {p < total && <p className="text-sm text-destructive">Reste à payer : {formatDA(total - p)}</p>}
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" className="h-16" onClick={() => setStep("cart")}>Retour</Button>
          <Button
            size="lg"
            className="h-16 text-lg"
            onClick={async () => {
              if (p > total || p < 0) return void toast.error("Montant payé invalide");
              if (p < total && !customer) return void toast.error("Choisissez un client pour une vente à crédit");
              const items = lines.map(([item_id, qty]) => ({ item_id, qty, price: price(item_id) }));
              const num = await rpc<string>("driver_sell", { _customer: customer || null, _items: items, _paid: p, _mode: mode });
              if (!num) return;
              toast.success(`Vente ${num} enregistrée`);
              showTicket({
                title: "TICKET DE VENTE",
                number: num,
                at: new Date().toISOString(),
                driver: driverName,
                vehicle: vehicle?.name ?? "",
                customer: custName(customer || undefined),
                lines: lines.map(([id, q]) => ({ name: itemName(id), qty: q, price: price(id) })),
                total,
                paid: p,
                mode,
              });
              setCart({});
              setPaid("");
              setCustomer("");
              setStep("cart");
              await after();
            }}
          >
            Encaisser
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stock.map((s) => {
          const q = cart[s.item_id] ?? 0;
          return (
            <div key={s.item_id} className={cn("rounded-2xl border-2 bg-card p-3", q ? "border-primary" : "border-border")}>
              <button className="w-full text-left" onClick={() => add(s.item_id, 1)}>
                <p className="font-semibold leading-tight">{itemName(s.item_id)}</p>
                <p className="mt-1 text-lg font-semibold text-primary">{formatDA(price(s.item_id))}</p>
                <p className="text-xs text-muted-foreground">Dispo : {formatNumber(s.quantity)}</p>
              </button>
              {q > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted" onClick={() => add(s.item_id, -1)} aria-label="Moins"><Minus className="h-5 w-5" /></button>
                  <span className="text-xl font-semibold">{q}</span>
                  <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground" onClick={() => add(s.item_id, 1)} aria-label="Plus"><Plus className="h-5 w-5" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-20 rounded-2xl bg-foreground p-4 text-background shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70">{lines.reduce((a, [, q]) => a + q, 0)} article(s)</p>
            <p className="font-display text-2xl font-semibold">{formatDA(total)}</p>
          </div>
          <div className="flex gap-2">
            {lines.length > 0 && <Button variant="outline" className="h-14 text-foreground" onClick={() => setCart({})}>Vider</Button>}
            <Button size="lg" className="h-14 text-lg" disabled={!lines.length || total <= 0} onClick={() => setStep("pay")}>Payer</Button>
          </div>
        </div>
        {lines.length > 0 && total <= 0 && <p className="mt-1 text-xs opacity-80">Prix de vente non renseigné pour ces articles.</p>}
      </div>
    </div>
  );
}

/* ---------- Clients ---------- */
function ClientsView({ after }: Ctx) {
  const { state } = useApp();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ name: string; phone: string; address: string } | null>(null);
  const list = state.customers.filter((c) => !search || normalize(`${c.name} ${c.phone} ${c.address}`).includes(normalize(search)));
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input className="h-12" placeholder="Rechercher un client" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button className="h-12" onClick={() => setForm({ name: search, phone: "", address: "" })}><Plus className="mr-1 h-5 w-5" /> Nouveau</Button>
      </div>
      {form && (
        <Card className="space-y-2">
          <Input className="h-12" placeholder="Nom *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input className="h-12" placeholder="Téléphone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input className="h-12" placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={() => setForm(null)}>Annuler</Button>
            <Button
              className="h-12"
              onClick={async () => {
                if (!form.name.trim()) return void toast.error("Le nom est obligatoire");
                const r = await rpc("driver_add_customer", { _name: form.name, _phone: form.phone, _address: form.address });
                if (r) { toast.success("Client ajouté"); setForm(null); await after(); }
              }}
            >
              Enregistrer
            </Button>
          </div>
        </Card>
      )}
      {list.slice(0, 60).map((c) => (
        <Card key={c.id}>
          <p className="font-semibold">{c.name}</p>
          <p className="text-sm text-muted-foreground">{c.phone || "—"} · {c.address || c.wilaya || "—"}</p>
          {c.phone && <a className="mt-2 inline-block text-sm font-medium text-primary" href={`tel:${c.phone}`}>Appeler</a>}
        </Card>
      ))}
    </div>
  );
}

/* ---------- Stock véhicule ---------- */
function StockView({ data, itemName }: Ctx) {
  if (!data.vstock.length) return <Center><p className="text-muted-foreground">Le véhicule est vide.</p></Center>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {data.vstock.map((s) => (
        <Card key={s.item_id}>
          <p className="text-sm font-medium">{itemName(s.item_id)}</p>
          <p className={cn("mt-1 font-display text-3xl font-semibold", s.quantity === 0 && "text-muted-foreground")}>{formatNumber(s.quantity)}</p>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Encaissements ---------- */
function CashView({ data, route }: Ctx) {
  const rows = data.cash.filter((c) => route && c.route_id === route.id);
  const sum = (m: string) => rows.filter((c) => c.mode === m).reduce((a, c) => a + c.amount, 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Espèces" value={formatDA(sum("espèces"))} />
        <Stat label="Virement" value={formatDA(sum("virement"))} />
        <Stat label="Chèque" value={formatDA(sum("chèque"))} />
        <Stat label="Crédit client" value={formatDA(sum("crédit"))} />
      </div>
      {rows.map((c) => (
        <Card key={c.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{c.reference}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)} · {c.source === "VENTE" ? "Vente directe" : "Livraison"}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatDA(c.amount)}</p>
            <p className="text-xs capitalize text-muted-foreground">{c.mode}</p>
          </div>
        </Card>
      ))}
      {!rows.length && <p className="text-center text-sm text-muted-foreground">Aucun encaissement sur la tournée en cours.</p>}
    </div>
  );
}

/* ---------- Retours ---------- */
function ReturnsView({ data, itemName, after }: Ctx) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [damaged, setDamaged] = useState(false);
  const [notes, setNotes] = useState("");
  const stock = data.vstock.filter((s) => s.quantity > 0);
  if (!stock.length) return <Center><p className="text-muted-foreground">Rien à retourner.</p></Center>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setDamaged(false)} className={cn("h-14 rounded-xl border font-medium", !damaged ? "border-primary bg-primary text-primary-foreground" : "border-border")}>Retour au dépôt</button>
        <button onClick={() => setDamaged(true)} className={cn("h-14 rounded-xl border font-medium", damaged ? "border-destructive bg-destructive text-destructive-foreground" : "border-border")}>Endommagé / manquant</button>
      </div>
      {stock.map((s) => (
        <Card key={s.item_id} className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{itemName(s.item_id)}</p>
            <p className="text-xs text-muted-foreground">Dans le véhicule : {formatNumber(s.quantity)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-11" onClick={() => setQty({ ...qty, [s.item_id]: String(s.quantity) })}>Tout</Button>
            <Input inputMode="decimal" className="h-12 w-20 text-center text-lg" value={qty[s.item_id] ?? ""} onChange={(e) => setQty({ ...qty, [s.item_id]: e.target.value })} />
          </div>
        </Card>
      ))}
      <Input className="h-12" placeholder="Remarque (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button
        size="lg"
        className="h-16 w-full text-lg"
        onClick={async () => {
          const items = Object.entries(qty).map(([item_id, v]) => ({ item_id, qty: Number(v.replace(",", ".")) || 0 })).filter((i) => i.qty > 0);
          if (!items.length) return void toast.error("Saisissez au moins une quantité");
          for (const i of items) if (i.qty > (stock.find((s) => s.item_id === i.item_id)?.quantity ?? 0)) return void toast.error("Quantité supérieure au stock véhicule");
          const num = await rpc<string>("driver_return", { _items: items, _damaged: damaged, _notes: notes });
          if (num) { toast.success(`${damaged ? "Perte" : "Retour"} ${num} enregistré`); setQty({}); setNotes(""); await after(); }
        }}
      >
        Valider
      </Button>
    </div>
  );
}

/* ---------- Historique ---------- */
function HistoryView({ data, itemName, custName, showTicket, driverName, vehicle }: Ctx) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Ventes directes</h2>
      {data.sales.slice(0, 30).map((s) => {
        const items = data.saleItems.filter((i) => i.sale_id === s.id);
        return (
          <Card key={s.id} className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{s.number} · {custName(s.customer_id)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(s.created_at)} · reste {formatDA(s.remaining)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatDA(s.total)}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                aria-label="Réimprimer"
                onClick={() =>
                  showTicket({
                    title: "TICKET DE VENTE", number: s.number, at: s.created_at, driver: driverName, vehicle: vehicle?.name ?? "",
                    customer: custName(s.customer_id), lines: items.map((i) => ({ name: itemName(i.item_id), qty: i.quantity, price: i.unit_price })),
                    total: s.total, paid: s.paid, mode: s.payment_mode,
                  })
                }
              >
                <Printer className="h-5 w-5" />
              </Button>
            </div>
          </Card>
        );
      })}
      <h2 className="pt-2 font-semibold">Mouvements du véhicule</h2>
      {data.vmov.slice(0, 50).map((m) => (
        <Card key={m.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{itemName(m.item_id)}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)} · {VMOV_LABELS[m.type] ?? m.type} · {m.number}</p>
          </div>
          <span className={cn("font-semibold", m.quantity < 0 ? "text-destructive" : "text-success")}>{m.quantity > 0 ? "+" : ""}{formatNumber(m.quantity)}</span>
        </Card>
      ))}
      <h2 className="pt-2 font-semibold">Tournées</h2>
      {data.routes.map((r) => (
        <Card key={r.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{r.number}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(r.opened_at)} · {r.status === "OUVERTE" ? "Ouverte" : "Clôturée"}</p>
          </div>
          {r.status !== "OUVERTE" && <span className="text-sm">{HANDOVER_LABELS[r.handover_status]}</span>}
        </Card>
      ))}
    </div>
  );
}

/* ---------- Clôture ---------- */
function CloseView({ data, route, after }: Ctx) {
  const [handed, setHanded] = useState("");
  if (!route) return <Center><p className="text-muted-foreground">Aucune tournée ouverte.</p></Center>;
  const mov = data.vmov.filter((m) => m.route_id === route.id);
  const q = (t: string) => Math.abs(mov.filter((m) => m.type === t).reduce((a, m) => a + m.quantity, 0));
  const cash = data.cash.filter((c) => c.route_id === route.id);
  const c = (m: string) => cash.filter((x) => x.mode === m).reduce((a, x) => a + x.amount, 0);
  const expected = c("espèces");
  const h = handed === "" ? expected : Number(handed.replace(",", ".")) || 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Stock chargé" value={`${formatNumber(q("CHARGEMENT"))} u.`} />
        <Stat label="Livré" value={`${formatNumber(q("LIVRAISON"))} u.`} />
        <Stat label="Vendu directement" value={`${formatNumber(q("VENTE"))} u.`} />
        <Stat label="Retour / perte" value={`${formatNumber(q("RETOUR") + q("PERTE"))} u.`} />
        <Stat label="Total encaissé" value={formatDA(c("espèces") + c("virement") + c("chèque"))} />
        <Stat label="Espèces" value={formatDA(expected)} />
        <Stat label="Virement / chèque" value={formatDA(c("virement") + c("chèque"))} />
        <Stat label="Crédit" value={formatDA(c("crédit"))} />
      </div>
      {data.vstock.some((s) => s.quantity > 0) && (
        <p className="rounded-xl bg-gold/20 p-3 text-sm">Il reste du stock dans le véhicule. Pensez au retour dépôt avant de clôturer.</p>
      )}
      <Card className="space-y-2">
        <p className="text-sm font-medium">Remise de caisse — espèces remises (DA)</p>
        <Input inputMode="decimal" className="h-14 text-lg" placeholder={String(expected)} value={handed} onChange={(e) => setHanded(e.target.value)} />
        <p className={cn("text-sm", h !== expected ? "text-destructive" : "text-muted-foreground")}>
          Attendu {formatDA(expected)} · Écart {formatDA(h - expected)}
        </p>
      </Card>
      <Button
        size="lg"
        variant="destructive"
        className="h-16 w-full text-lg"
        onClick={async () => {
          if (!window.confirm("Clôturer la tournée ? Cette action est définitive.")) return;
          const num = await rpc<string>("close_route", { _cash_handed: h });
          if (num) { toast.success(`Tournée ${num} clôturée`); setHanded(""); await after(); }
        }}
      >
        <Lock className="mr-2 h-6 w-6" /> Clôturer la tournée
      </Button>
    </div>
  );
}

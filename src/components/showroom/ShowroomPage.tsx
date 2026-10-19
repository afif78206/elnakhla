import { logoUrl } from "@/lib/brand";
import { printThermalTicket } from "@/lib/ticket-print";
import { useNavigate } from "@tanstack/react-router";
import { Banknote, Barcode, CreditCard, Download, Gift, History, Package, LogOut, Minus, Pencil, Plus, Printer, ScanLine, Search, ShoppingCart, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Field } from "@/components/common/Field";
import { selectClass } from "@/components/common/select-class";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TicketPrintPortal, type TicketData } from "@/components/fleet/Ticket80";
import { rpc } from "@/lib/fleet";
import { formatDA, formatNumber } from "@/lib/format";
import { normalize } from "@/lib/text";
import type { StockCategory, StockItem, StockUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { bundleQuantity, orderAmounts, parseOrderQuantity, parseTiers, wholesaleUnitPrice, type OrderKind } from "@/lib/showroom-order";
import { WholesaleReceipt, WholesalePrintPortal, printWholesaleReceipt, downloadWholesalePdf } from "@/components/showroom/WholesaleReceipt";
import { ProductPhoto, ProductPhotoPicker } from "@/components/showroom/ProductPhoto";
import { CustomerAccounts, useCustomerPayments } from "@/components/showroom/CustomerAccounts";
import { WholesaleHistory, type ShowroomDoc } from "@/components/showroom/WholesaleHistory";

type Item = StockItem & { barcode?: string | null };
interface Line { id: string; qty: number; qtyText?: string | undefined; bundles?: { count: string; size: string } | undefined }
type PayPlan = "COMPLET" | "PARTIEL" | "CREDIT";
interface RawLine { name: string; qty: number; price: number; bundles?: { count: string; size: string } | null }
type RawDoc = Omit<ShowroomDoc["data"], "lines"> & { kind: "CADEAU" | "GROS"; lines: RawLine[] };

function docToTicket(d: RawDoc): TicketData {
  const gift = d.kind === "CADEAU";
  return {
    title: gift ? "TICKET CADEAU" : "BON DE VENTE EN GROS", number: d.number, at: d.at, driver: d.driver, vehicle: "Showroom", variant: "showroom", gift,
    customer: gift ? [d.beneficiary, d.motive].filter(Boolean).join(" — ") : d.customer, total: Number(d.total), paid: Number(d.paid), mode: d.mode,
    lines: d.lines.map((l) => ({ name: l.name, qty: Number(l.qty), price: Number(l.price), bundles: l.bundles ? Number(l.bundles.count) || null : null, bundleSize: l.bundles ? Number(l.bundles.size) || null : null })),
  };
}

const CATEGORIES: StockCategory[] = ["Huile en vrac", "Bouteilles", "Bidons", "Bouchons", "Cartons", "Étiquettes", "Autres emballages"];
const UNITS: StockUnit[] = ["L", "kg", "unité", "carton"];
const KIND_LABEL: Record<OrderKind, string> = { DETAIL: "Détail", CADEAU: "Cadeau", GROS: "Gros" };

// Douchettes en AZERTY : les chiffres arrivent en symboles, on les traduit.
const AZERTY_DIGITS: Record<string, string> = { "&": "1", "é": "2", '"': "3", "'": "4", "(": "5", "-": "6", "è": "7", "_": "8", "ç": "9", "à": "0" };
const fixScan = (s: unknown) => String(s ?? "").split("").map((c) => AZERTY_DIGITS[c] ?? c).join("");

interface NewItemForm { name: string; category: StockCategory; quantity: string; unit: StockUnit; salePrice: string; barcode: string; minQuantity: string; bundleSize: string; wholesalePrice: string; tiers: string; location: string; imageUrl: string }
const emptyItem: NewItemForm = { name: "", category: "Bouteilles", quantity: "", unit: "unité", salePrice: "", barcode: "", minQuantity: "0", bundleSize: "0", wholesalePrice: "", tiers: "", location: "", imageUrl: "" };

function printShowroomTicket() { void printThermalTicket(80); }

export function ShowroomPage() {
  const { currentUser, ready, logout, state, resetDemo, canEdit, add: addRow, update: updateRow } = useApp();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<string>("espèces");
  const [received, setReceived] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderKind, setOrderKind] = useState<OrderKind>("DETAIL");
  const [pendingKind, setPendingKind] = useState<OrderKind | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [customerQ, setCustomerQ] = useState("");
  const [payPlan, setPayPlan] = useState<PayPlan>("COMPLET");
  const [beneficiary, setBeneficiary] = useState("");
  const [motive, setMotive] = useState("");
  const [wholesale, setWholesale] = useState<TicketData | null>(null);
  const [documents, setDocuments] = useState<ShowroomDoc[]>([]);
  const requestId = useRef<string | null>(null);
  const checkoutBusy = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [nc, setNc] = useState({ name: "", phone: "", company: "", address: "" });
  const refreshDocuments = () => api.list<ShowroomDoc>("showroom_documents").then((rows) => setDocuments(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)))).catch(() => undefined);
  const { rows: customerPayments, refresh: refreshPayments } = useCustomerPayments(!!currentUser);
  useEffect(() => { if (currentUser) void refreshDocuments(); }, [currentUser?.id]);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  // Ticket thermique (détail/cadeau) imprimé dès qu'il est affiché.
  useEffect(() => { if (ticket) printShowroomTicket(); }, [ticket]);
  const [tab, setTab] = useState<"pos" | "clients" | "historique" | "codes">("pos");
  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState<NewItemForm>(emptyItem);
  const [editId, setEditId] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const allowed = currentUser && ["VENDEUR", "ADMIN", "COMMERCIAL"].includes(currentUser.role);
  const items = state.stockItems as Item[];
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const modePrice = (i: Item, qty = 1) => orderKind === "CADEAU" ? 0 : orderKind === "GROS" ? wholesaleUnitPrice(i, qty) : Number(i.salePrice ?? 0);
  const sellable = items.filter((i) => orderKind === "CADEAU" ? Number(i.quantity) > 0 : modePrice(i) > 0);
  const shown = sellable.filter((i) => !query || normalize(i.name).includes(normalize(query)) || String(i.barcode ?? "").includes(query));
  const pickList = useMemo(() => {
    const q = normalize(pick);
    return items.filter((i) => !q || normalize(i.name).includes(q) || String(i.barcode ?? "").includes(q)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [items, pick]);
  const customerOptions = useMemo(() => state.customers.filter((c) => !customerQ || normalize(`${c.name} ${c.company} ${c.phone}`).includes(normalize(customerQ))).slice(0, 8), [state.customers, customerQ]);
  const selectedCustomer = state.customers.find((c) => c.id === customerId);
  const customerDebtNow = selectedCustomer ? state.sales.filter((s) => s.customerId === selectedCustomer.id).reduce((t, s) => t + Math.max(Number(s.remaining) || 0, 0), 0) : 0;

  function openNew() { setPicking(false); setEditId(null); setItemForm(emptyItem); setItemOpen(true); }
  function openPick() { setPicking(true); setEditId(null); setPick(""); setItemOpen(true); }
  function openEdit(it: Item) {
    setPicking(false);
    setEditId(it.id);
    setItemForm({
      name: it.name, category: it.category, quantity: String(it.quantity ?? ""), unit: it.unit,
      salePrice: it.salePrice != null ? String(it.salePrice) : "", barcode: String(it.barcode ?? ""),
      minQuantity: String(it.minQuantity ?? 0), bundleSize: String(it.bundleSize ?? 0),
      wholesalePrice: Number(it.wholesalePrice ?? 0) > 0 ? String(it.wholesalePrice) : "",
      tiers: (Array.isArray(it.wholesaleTiers) ? it.wholesaleTiers : []).map((t) => `${t.min}:${t.price}`).join(", "),
      location: it.location ?? "", imageUrl: it.imageUrl ?? "",
    });
    setItemOpen(true);
  }
  function closeItem() { if (photoBusy || savingItem) return; setItemOpen(false); setPicking(false); setEditId(null); }

  useEffect(() => { if (ready && !currentUser) navigate({ to: "/" }); }, [ready, currentUser, navigate]);
  useEffect(() => { if (tab === "pos") scanRef.current?.focus(); }, [tab]);

  // Douchette + raccourcis : F2 recherche, F9 valider.
  const scanBuf = useRef({ text: "", at: 0 });
  useEffect(() => {
    if (tab !== "pos") return;
    function onKey(e: KeyboardEvent) {
      if (itemOpen || previewOpen || newCustomerOpen) return;
      if (e.key === "F2") { e.preventDefault(); scanRef.current?.focus(); scanRef.current?.select(); return; }
      if (e.key === "F9") { e.preventDefault(); void checkout(); return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") && t !== scanRef.current) return;
      const now = Date.now();
      const buf = scanBuf.current;
      if (now - buf.at > 100) buf.text = "";
      buf.at = now;
      if (e.key === "Enter") {
        const code = buf.text.trim();
        buf.text = "";
        if (code.length >= 4) { e.preventDefault(); handleScan(code); }
        return;
      }
      if (e.key.length === 1) buf.text += e.key;
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, itemOpen, previewOpen, newCustomerOpen, items, cart, orderKind, customerId, payPlan, received, beneficiary, motive, mode]);

  if (!ready || !currentUser) return <div className="flex min-h-screen items-center justify-center">Chargement…</div>;
  if (!allowed)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Accès réservé aux vendeurs du showroom.</p>
        <Button onClick={() => navigate({ to: "/tableau-de-bord" })}>Retour</Button>
      </div>
    );

  function add(it: Item, n = 1) {
    if (checkoutBusy.current) return;
    requestId.current = null;
    const existing = cart.find((l) => l.id === it.id);
    const baseSize = existing?.bundles?.size ?? (Number(it.bundleSize ?? 0) > 0 ? String(Math.floor(Number(it.bundleSize))) : "");
    if (orderKind === "GROS" && baseSize) {
      const count = String((existing ? parseOrderQuantity(existing.bundles?.count ?? "") || 0 : 0) + n);
      const qty = bundleQuantity(count, baseSize);
      if (!Number.isFinite(qty) || qty > Number(it.quantity)) { toast.error(`Stock insuffisant : ${formatNumber(Number(it.quantity))} disponible`); return; }
      setCart((c) => (existing ? c.map((l) => (l.id === it.id ? { ...l, bundles: { count, size: baseSize }, qty, qtyText: undefined } : l)) : [...c, { id: it.id, qty, bundles: { count, size: baseSize } }]));
      return;
    }
    if ((existing?.qty ?? 0) + n > Number(it.quantity)) { toast.error(`Stock insuffisant : ${formatNumber(Number(it.quantity))} disponible`); return; }
    setCart((c) => (existing ? c.map((l) => (l.id === it.id ? { ...l, qty: l.qty + n, qtyText: undefined, bundles: undefined } : l)) : [...c, { id: it.id, qty: n }]));
  }
  function setQty(id: string, q: number) {
    if (checkoutBusy.current) return;
    requestId.current = null;
    const it = byId.get(id);
    if (!it || !Number.isFinite(q)) return;
    if (q <= 0) { setCart((c) => c.filter((l) => l.id !== id)); return; }
    if (q > Number(it.quantity)) { toast.error("Stock insuffisant"); return; }
    setCart((c) => c.map((l) => (l.id === id ? { ...l, qty: q, qtyText: undefined, bundles: undefined } : l)));
  }
  function editQuantity(id: string, text: string) {
    if (checkoutBusy.current) return;
    const item = byId.get(id);
    const qty = parseOrderQuantity(text);
    if (!item || !Number.isFinite(qty) || qty < 0) return;
    if (qty > Number(item.quantity)) { toast.error("Stock insuffisant"); return; }
    requestId.current = null;
    setCart((rows) => rows.map((row) => row.id === id ? { ...row, qty, qtyText: text, bundles: undefined } : row));
  }
  function editBundles(id: string, field: "count" | "size", value: string) {
    if (checkoutBusy.current) return;
    const row = cart.find((line) => line.id === id);
    const item = byId.get(id);
    if (!row || !item) return;
    const bundles = { ...(row.bundles ?? { count: "", size: "" }), [field]: value };
    const qty = bundleQuantity(bundles.count, bundles.size);
    if (!Number.isFinite(qty)) { toast.error("Saisissez un nombre entier positif."); return; }
    if (qty > Number(item.quantity)) { toast.error(`Stock insuffisant : ${formatNumber(Number(item.quantity))} disponible`); return; }
    requestId.current = null;
    setCart((rows) => rows.map((line) => line.id === id ? { ...line, bundles, qty, qtyText: undefined } : line));
  }
  function handleScan(raw: string) {
    const code = fixScan(raw.trim());
    if (!code) return;
    const it = items.find((i) => i.barcode && fixScan(i.barcode) === code);
    if (!it) {
      if (shown.length === 1 && shown[0]) { add(shown[0]); setQuery(""); return; }
      if (!shown.length) toast.error(`Aucun produit pour « ${code} »`);
      return;
    }
    if (orderKind !== "CADEAU" && !(modePrice(it) > 0)) { toast.error(`${it.name} n'a pas de prix ${orderKind === "GROS" ? "de gros" : "de vente"}`); return; }
    add(it);
    setQuery("");
    setTimeout(() => scanRef.current?.focus(), 0);
  }

  const lines = cart.flatMap((l) => { const it = byId.get(l.id); return it ? [{ ...l, it }] : []; });
  const priceOf = (l: typeof lines[number]) => modePrice(l.it, l.qty);
  const total = lines.reduce((s, l) => s + l.qty * priceOf(l), 0);
  const recv = Number(received.replace(",", ".")) || 0;
  const change = recv - total;
  const grossPaid = payPlan === "COMPLET" ? total : payPlan === "CREDIT" ? 0 : recv;

  async function checkout() {
    if (checkoutBusy.current || !currentUser) return;
    if (!lines.length) { toast.error("Panier vide"); return; }
    if (orderKind === "GROS" && !customerId) { toast.error("Choisissez le client"); return; }
    if (orderKind === "CADEAU" && (!beneficiary.trim() || !motive.trim())) { toast.error("Indiquez le bénéficiaire et le motif du cadeau"); return; }
    if (orderKind === "GROS" && payPlan === "PARTIEL" && !(recv > 0 && recv < total)) { toast.error("Paiement partiel : saisissez un montant entre 0 et le total"); return; }
    if (lines.some((l) => !Number.isFinite(l.qty) || l.qty <= 0 || (orderKind !== "CADEAU" && !(priceOf(l) > 0)))) { toast.error("Quantité ou prix invalide"); return; }
    let amounts;
    try { amounts = orderAmounts(orderKind, lines.map((l) => ({ qty: l.qty, price: priceOf(l) })), orderKind === "GROS" ? String(grossPaid) : orderKind === "DETAIL" && mode !== "espèces" ? "" : received); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Montant invalide"); return; }
    checkoutBusy.current = true;
    setCheckingOut(true);
    try {
      if (orderKind === "DETAIL") {
        const num = await rpc<string>("showroom_sell", { _items: lines.map((l) => ({ item_id: l.id, qty: l.qty })), _mode: mode });
        if (!num) return;
        setWholesale(null);
        setTicket({ title: "TICKET DE CAISSE", number: num, at: new Date().toISOString(), driver: `${currentUser.firstName} ${currentUser.lastName}`, vehicle: "Showroom", lines: lines.map((l) => ({ name: l.it.name, qty: l.qty, price: priceOf(l) })), ...amounts, mode, variant: "showroom" });
        toast.success(`Vente ${num} encaissée`);
      } else {
        requestId.current ??= crypto.randomUUID();
        const saved = await rpc<RawDoc>("showroom_document", { _id: requestId.current, _kind: orderKind, _items: lines.map((l) => ({ item_id: l.id, qty: l.qty, bundles: l.bundles ?? null })), _mode: mode, _paid: amounts.paid, _customer: customerId || null, _beneficiary: beneficiary.trim(), _motive: motive.trim() });
        if (!saved) return;
        requestId.current = null;
        const t = docToTicket({ ...saved, kind: orderKind as "CADEAU" | "GROS" });
        if (orderKind === "GROS") { setTicket(null); setWholesale(t); setPreviewOpen(true); }
        else { setWholesale(null); setTicket(t); }
        void refreshDocuments();
        toast.success(`${orderKind === "CADEAU" ? "Cadeau" : "Vente en gros"} ${t.number} enregistré`);
      }
      setCart([]); setReceived(""); setMode("espèces"); setPayPlan("COMPLET"); setBeneficiary(""); setMotive("");
      await resetDemo();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible"); }
    finally { setCheckingOut(false); checkoutBusy.current = false; }
  }

  function applyKind(kind: OrderKind) { setOrderKind(kind); setReceived(""); setPayPlan("COMPLET"); requestId.current = null; setCart([]); }
  function changeOrderKind(kind: OrderKind) {
    if (checkingOut || kind === orderKind) return;
    if (cart.length) { setPendingKind(kind); return; }
    applyKind(kind);
  }

  function openSaved(d: ShowroomDoc) {
    const t = docToTicket({ ...(d.data as unknown as RawDoc), kind: d.kind });
    if (d.kind === "GROS") { setTicket(null); setWholesale(t); setPreviewOpen(true); }
    else { setWholesale(null); setTicket(t); }
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!nc.name.trim()) { toast.error("Le nom du client est obligatoire."); return; }
    const c = { id: crypto.randomUUID(), name: nc.name.trim(), company: nc.company.trim(), phone: nc.phone.trim(), address: nc.address.trim(), wilaya: "", type: (nc.company.trim() ? "professionnel" : "particulier") as "professionnel" | "particulier", notes: "", createdAt: new Date().toISOString() };
    if (!(await addRow("customers", c))) return;
    toast.success(`Client « ${c.name} » ajouté`);
    setCustomerId(c.id); setCustomerQ(""); setNc({ name: "", phone: "", company: "", address: "" }); setNewCustomerOpen(false);
  }

  async function submitItem(e: React.FormEvent) {
    e.preventDefault();
    if (photoBusy || savingItem) return;
    if (!itemForm.name.trim()) { toast.error("Le nom du produit est obligatoire."); return; }
    const qty = Number(itemForm.quantity.replace(",", "."));
    const price = Number(itemForm.salePrice.replace(",", "."));
    const wprice = itemForm.wholesalePrice.trim() ? Number(itemForm.wholesalePrice.replace(",", ".")) : 0;
    const tiers = parseTiers(itemForm.tiers);
    if (!(qty >= 0)) { toast.error("Quantité invalide."); return; }
    if (!(price > 0)) { toast.error("Le prix de vente doit être supérieur à 0."); return; }
    if (!(wprice >= 0)) { toast.error("Prix de gros invalide."); return; }
    if (!tiers) { toast.error("Paliers invalides. Exemple : 120:850, 240:800"); return; }
    const name = itemForm.name.trim();
    const barcode = fixScan(itemForm.barcode.trim());
    const fields: Omit<StockItem, "id"> = {
      name, category: itemForm.category, quantity: qty, unit: itemForm.unit,
      minQuantity: Number(itemForm.minQuantity) || 0, bundleSize: Number(itemForm.bundleSize) || 0,
      wholesalePrice: wprice, wholesaleTiers: tiers,
      location: itemForm.location, salePrice: price, imageUrl: itemForm.imageUrl,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setSavingItem(true);
    try {
      if (editId) {
        if (!(await updateRow("stockItems", editId, fields))) return;
        if (barcode) { try { await api.update("stock_items", editId, { barcode }); } catch { toast.error("Code-barres non enregistré (déjà utilisé ?)"); } }
        toast.success(`Produit « ${name} » modifié`);
      } else {
        const item: StockItem = { id: crypto.randomUUID(), ...fields };
        if (!(await addRow("stockItems", item))) return;
        if (barcode) { try { await api.update("stock_items", item.id, { barcode }); } catch { toast.error("Code-barres non enregistré (déjà utilisé ?)"); } }
        toast.success(`Produit « ${name} » ajouté`);
      }
      setItemForm(emptyItem); setEditId(null); setPicking(false); setItemOpen(false);
      resetDemo();
    } finally { setSavingItem(false); }
  }

  const validateLabel = checkingOut ? "Enregistrement…" : orderKind === "CADEAU" ? "Valider le cadeau" : orderKind === "GROS" ? "Valider la vente en gros" : "Encaisser";
  const TABS = [
    { k: "pos", label: "Caisse", icon: ShoppingCart },
    { k: "clients", label: "Clients & crédits", icon: Users },
    { k: "historique", label: "Historique", icon: History },
  ] as const;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-sidebar px-3 py-2 text-sidebar-foreground xl:flex-nowrap">
        <img src={logoUrl} alt="Logo Medjadja Olive" className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">Medjadja Olive — Showroom</p>
          <p className="text-xs opacity-70">Vendeur : {currentUser.firstName} {currentUser.lastName}</p>
        </div>
        <nav className="flex flex-wrap gap-1" aria-label="Sections">
          {TABS.map(({ k, label, icon: Icon }) => <Button key={k} size="sm" variant={tab === k ? "default" : "secondary"} onClick={() => setTab(k)}><Icon className="h-4 w-4" /> {label}</Button>)}
        </nav>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {canEdit("stock") && <>
            <Button size="sm" variant="secondary" onClick={openNew}><Plus className="h-4 w-4" /> Produit</Button>
            <Button size="sm" variant="secondary" onClick={openPick}><Pencil className="h-4 w-4" /> Modifier</Button>
            <Button size="sm" variant={tab === "codes" ? "default" : "secondary"} onClick={() => setTab(tab === "codes" ? "pos" : "codes")}><Barcode className="h-4 w-4" /> Codes-barres</Button>
          </>}
          {currentUser.role !== "VENDEUR" && <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/tableau-de-bord" })}>Logiciel</Button>}
          {ticket && <Button size="sm" variant="secondary" onClick={printShowroomTicket}><Printer className="h-4 w-4" /> Réimprimer ticket</Button>}
          {wholesale && <Button size="sm" variant="secondary" onClick={() => setPreviewOpen(true)}><Printer className="h-4 w-4" /> Dernier bon</Button>}
          <Button size="sm" variant="ghost" onClick={() => { logout(); navigate({ to: "/" }); }} aria-label="Déconnexion"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {tab === "codes" ? <div className="min-h-0 flex-1 overflow-y-auto"><BarcodeAdmin items={items} onSaved={resetDemo} /></div>
      : tab === "clients" ? <CustomerAccounts customers={state.customers} sales={state.sales} payments={customerPayments} onNewCustomer={() => setNewCustomerOpen(true)} onPaid={async () => { await resetDemo(); await refreshPayments(); }} />
      : tab === "historique" ? <WholesaleHistory docs={documents} sales={state.sales} payments={customerPayments} onOpen={openSaved} />
      : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(320px,36%)] xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
              <form onSubmit={(e) => { e.preventDefault(); handleScan(query); }} className="relative min-w-[180px] flex-1">
                <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <Input ref={scanRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher ou scanner un code-barres (F2)" className="h-12 pl-11 text-base" aria-label="Recherche ou code-barres" />
                {query && <button type="button" aria-label="Effacer" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
              </form>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1" role="group" aria-label="Mode de vente">
                {(["DETAIL", "CADEAU", "GROS"] as OrderKind[]).map((k) => {
                  const Icon = k === "DETAIL" ? ShoppingCart : k === "CADEAU" ? Gift : Package;
                  return <Button key={k} className="h-10 min-w-0 px-2 sm:px-3" variant={orderKind === k ? "default" : "ghost"} aria-pressed={orderKind === k} onClick={() => changeOrderKind(k)} disabled={checkingOut}><Icon className="h-4 w-4" /> {KIND_LABEL[k].toUpperCase()}</Button>;
                })}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3 2xl:grid-cols-4">
                {shown.map((i) => {
                  const out = Number(i.quantity) <= 0;
                  const inCart = cart.find((l) => l.id === i.id);
                  return <div key={i.id} role="button" tabIndex={0}
                    onClick={() => { if (!out) add(i); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!out) add(i); } }}
                    className={cn("card-surface group relative flex cursor-pointer flex-col overflow-hidden text-left transition hover:border-primary hover:shadow-md", out && "cursor-not-allowed opacity-40", inCart && "border-primary ring-1 ring-primary")}>
                    {canEdit("stock") && <Button type="button" size="icon" variant="outline" aria-label={`Modifier ${i.name}`} onClick={(e) => { e.stopPropagation(); openEdit(i); }} className="absolute right-1.5 top-1.5 z-10 h-7 w-7 bg-background/90"><Pencil className="h-3.5 w-3.5" /></Button>}
                    {inCart && <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{formatNumber(inCart.qty)}</span>}
                    <ProductPhoto source={i.imageUrl} name={i.name} className="h-32 w-full" />
                    <div className="flex flex-1 flex-col gap-0.5 p-2.5">
                      <span className="line-clamp-2 text-sm font-medium leading-tight">{i.name}</span>
                      <span className="text-xs text-muted-foreground">{i.category}{Number(i.bundleSize ?? 0) > 0 ? ` · carton de ${formatNumber(Number(i.bundleSize))}` : ""}</span>
                      <div className="mt-auto flex items-end justify-between gap-1 pt-1">
                        <span className="font-display text-lg font-semibold text-primary">{orderKind === "CADEAU" ? "Offert" : formatDA(modePrice(i))}</span>
                        <span className={cn("text-xs", Number(i.quantity) <= Number(i.minQuantity) ? "font-semibold text-destructive" : "text-muted-foreground")}>{formatNumber(Number(i.quantity))} {i.unit}</span>
                      </div>
                      {orderKind === "GROS" && Array.isArray(i.wholesaleTiers) && i.wholesaleTiers.length > 0 && <span className="text-[11px] text-muted-foreground">Paliers : {i.wholesaleTiers.map((t) => `dès ${formatNumber(t.min)} → ${formatNumber(t.price)}`).join(" · ")}</span>}
                    </div>
                  </div>;
                })}
                {!shown.length && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">{orderKind === "GROS" ? "Aucun produit avec prix de gros ou de vente." : "Aucun produit trouvé."}</p>}
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 min-w-0 flex-col border-t border-border bg-card md:border-l md:border-t-0">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
              <h2 className="font-display text-lg font-semibold">Panier · {KIND_LABEL[orderKind]}</h2>
              <Button size="sm" variant="ghost" onClick={() => { setCart([]); requestId.current = null; }} disabled={!lines.length || checkingOut}>Vider</Button>
            </div>
            {orderKind === "GROS" && <div className="shrink-0 space-y-1.5 border-b border-border p-3">
              {selectedCustomer ? <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
                <span className="min-w-0"><b className="block truncate">{selectedCustomer.name}</b><span className={cn("text-xs", customerDebtNow > 0 ? "text-destructive" : "text-muted-foreground")}>Dette actuelle : {formatDA(customerDebtNow)}</span></span>
                <Button size="sm" variant="ghost" onClick={() => { setCustomerId(""); requestId.current = null; }}>Changer</Button>
              </div> : <>
                <div className="flex gap-1"><Input value={customerQ} onChange={(e) => setCustomerQ(e.target.value)} placeholder="Client * (nom, téléphone)" aria-label="Rechercher un client" /><Button size="icon" variant="outline" aria-label="Nouveau client" onClick={() => setNewCustomerOpen(true)}><Plus className="h-4 w-4" /></Button></div>
                {customerQ && <div className="max-h-36 overflow-y-auto rounded-md border border-border">{customerOptions.map((c) => <button key={c.id} type="button" className="block w-full truncate px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setCustomerId(c.id); setCustomerQ(""); requestId.current = null; }}>{c.name}{c.company ? ` — ${c.company}` : ""}</button>)}{!customerOptions.length && <p className="p-2 text-xs text-muted-foreground">Aucun client. Utilisez +</p>}</div>}
              </>}
            </div>}
            {orderKind === "CADEAU" && <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-border p-3">
              <Input value={beneficiary} onChange={(e) => { setBeneficiary(e.target.value); requestId.current = null; }} placeholder="Bénéficiaire *" aria-label="Bénéficiaire" />
              <Input value={motive} onChange={(e) => { setMotive(e.target.value); requestId.current = null; }} placeholder="Motif *" aria-label="Motif du cadeau" />
            </div>}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {lines.map((l) => (
                <div key={l.id} className="rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.it.name}</p>
                      <p className="text-xs text-muted-foreground">{orderKind === "CADEAU" ? "Offert" : `${formatDA(priceOf(l))} × ${formatNumber(l.qty)} = ${formatDA(priceOf(l) * l.qty)}`}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" aria-label={`Retirer ${l.it.name}`} onClick={() => setQty(l.id, 0)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {orderKind === "GROS" && l.bundles ? <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => editBundles(l.id, "count", String(Math.max((parseOrderQuantity(l.bundles?.count ?? "") || 0) - 1, 0)))}><Minus className="h-3 w-3" /></Button>
                    <Input aria-label={`Cartons ${l.it.name}`} className="h-9 w-16 text-center" inputMode="numeric" value={l.bundles.count} disabled={checkingOut} onChange={(e) => editBundles(l.id, "count", e.target.value)} />
                    <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => add(l.it)}><Plus className="h-3 w-3" /></Button>
                    <span className="text-xs text-muted-foreground">carton(s) ×</span>
                    <Input aria-label={`Unités par carton ${l.it.name}`} className="h-9 w-14 text-center" inputMode="numeric" value={l.bundles.size} disabled={checkingOut} onChange={(e) => editBundles(l.id, "size", e.target.value)} />
                    <span className="whitespace-nowrap text-xs font-semibold">= {formatNumber(l.qty)} {l.it.unit}</span>
                  </div> : <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setQty(l.id, l.qty - 1)}><Minus className="h-3 w-3" /></Button>
                    <Input aria-label={`Quantité ${l.it.name}`} className="h-9 w-20 text-center" inputMode="decimal" value={l.qtyText ?? String(l.qty)} disabled={checkingOut} onChange={(e) => editQuantity(l.id, e.target.value)} />
                    <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => add(l.it)}><Plus className="h-3 w-3" /></Button>
                    <span className="text-xs text-muted-foreground">{l.it.unit}</span>
                  </div>}
                </div>
              ))}
              {!lines.length && <p className="py-10 text-center text-sm text-muted-foreground">Touchez un produit ou scannez un code-barres.</p>}
            </div>
            <div className="z-10 shrink-0 space-y-2 border-t border-border bg-card p-3 shadow-[0_-4px_18px_rgba(0,0,0,0.06)]">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">{orderKind === "CADEAU" ? "À ENCAISSER" : "TOTAL"}</span>
                <span className="font-display text-3xl font-bold">{formatDA(total)}</span>
              </div>
              {orderKind !== "CADEAU" && !(orderKind === "GROS" && payPlan === "CREDIT") && <div className="grid grid-cols-2 gap-1">
                <Button variant={mode === "espèces" ? "default" : "outline"} aria-pressed={mode === "espèces"} onClick={() => setMode("espèces")}><Banknote className="h-4 w-4" /> Cash</Button>
                <Button variant={mode === "TPE" ? "default" : "outline"} aria-pressed={mode === "TPE"} onClick={() => setMode("TPE")}><CreditCard className="h-4 w-4" /> TPE</Button>
              </div>}
              {orderKind === "GROS" && <div className="grid grid-cols-3 gap-1" role="group" aria-label="Paiement">
                {([["COMPLET", "Complet"], ["PARTIEL", "Partiel"], ["CREDIT", "Crédit"]] as const).map(([k, label]) => <Button key={k} size="sm" variant={payPlan === k ? "default" : "outline"} aria-pressed={payPlan === k} onClick={() => { setPayPlan(k); setReceived(""); requestId.current = null; }}>{label}</Button>)}
              </div>}
              {orderKind === "GROS" && payPlan === "PARTIEL" && <Input inputMode="decimal" aria-label="Montant versé" placeholder="Montant versé" value={received} onChange={(e) => { setReceived(e.target.value); requestId.current = null; }} />}
              {orderKind === "GROS" && <div className="flex justify-between text-sm"><span>Versé : <b>{formatDA(grossPaid)}</b></span><span>Reste : <b className={total - grossPaid > 0 ? "text-destructive" : ""}>{formatDA(Math.max(total - grossPaid, 0))}</b></span></div>}
              {orderKind === "DETAIL" && mode === "espèces" && <div className="flex items-center gap-2">
                <Input inputMode="decimal" aria-label="Montant reçu" placeholder="Montant reçu (facultatif)" value={received} onChange={(e) => setReceived(e.target.value)} />
                <span className={cn("whitespace-nowrap text-sm font-semibold", change < 0 ? "text-destructive" : "text-success")}>{received ? `Rendu : ${formatDA(Math.max(change, 0))}` : ""}</span>
              </div>}
              <Button className="h-14 w-full text-lg" onClick={() => void checkout()} disabled={!lines.length || checkingOut}>{validateLabel} <span className="ml-1 text-xs opacity-70">F9</span></Button>
            </div>
          </aside>
        </div>
      )}

      <ConfirmDelete open={!!pendingKind} onOpenChange={(o) => { if (!o) setPendingKind(null); }} title={`Passer en mode ${pendingKind ? KIND_LABEL[pendingKind] : ""} ?`} label="Le panier en cours sera vidé, car les prix et les champs changent selon le mode." confirmLabel="Changer de mode" onConfirm={() => { if (pendingKind) applyKind(pendingKind); setPendingKind(null); }} />

      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <form onSubmit={saveCustomer} className="space-y-3">
            <Field label="Nom *"><Input autoFocus value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Field>
            <Field label="Téléphone"><Input inputMode="tel" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></Field>
            <Field label="Société"><Input value={nc.company} onChange={(e) => setNc({ ...nc, company: e.target.value })} /></Field>
            <Field label="Adresse"><Input value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} /></Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setNewCustomerOpen(false)}>Annuler</Button><Button type="submit">Ajouter</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={closeItem}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{picking ? "Modifier un produit" : editId ? "Modifier le produit" : "Nouveau produit"}</DialogTitle></DialogHeader>
          {picking ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Rechercher le produit à modifier" className="pl-9" />
              </div>
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {pickList.map((i) => (
                  <button key={i.id} type="button" onClick={() => openEdit(i)} className="flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left text-sm transition hover:border-primary">
                    <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDA(Number(i.salePrice ?? 0))} · {formatNumber(Number(i.quantity))} {i.unit}</span>
                  </button>
                ))}
                {!pickList.length && <p className="py-8 text-center text-sm text-muted-foreground">Aucun produit trouvé.</p>}
              </div>
            </div>
          ) : (
            <form onSubmit={submitItem} className="space-y-4">
              <ProductPhotoPicker value={itemForm.imageUrl} onChange={(imageUrl) => setItemForm((form) => ({ ...form, imageUrl }))} busy={photoBusy} onBusy={setPhotoBusy} />
              <Field label="Nom du produit *"><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Ex : Huile d'olive 1 L" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Catégorie"><select className={selectClass} value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as StockCategory })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
                <Field label="Unité"><select className={selectClass} value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value as StockUnit })}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></Field>
                <Field label="Quantité en stock *"><Input inputMode="decimal" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} /></Field>
                <Field label="Prix de détail (DA) *"><Input inputMode="decimal" value={itemForm.salePrice} onChange={(e) => setItemForm({ ...itemForm, salePrice: e.target.value })} /></Field>
                <Field label="Prix de gros (DA / unité)"><Input inputMode="decimal" value={itemForm.wholesalePrice} onChange={(e) => setItemForm({ ...itemForm, wholesalePrice: e.target.value })} placeholder="Vide = prix de détail" /></Field>
                <Field label="Unités par carton / fardeau"><Input inputMode="numeric" value={itemForm.bundleSize} onChange={(e) => setItemForm({ ...itemForm, bundleSize: e.target.value })} placeholder="0 = vendu à l'unité" /></Field>
                <Field label="Code-barres"><Input value={itemForm.barcode} onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })} placeholder="Scanner ou taper…" /></Field>
                <Field label="Stock minimum"><Input inputMode="decimal" value={itemForm.minQuantity} onChange={(e) => setItemForm({ ...itemForm, minQuantity: e.target.value })} /></Field>
              </div>
              <Field label="Paliers de gros (unités : prix)"><Input value={itemForm.tiers} onChange={(e) => setItemForm({ ...itemForm, tiers: e.target.value })} placeholder="Ex : 120:850, 240:800 (dès 120 unités → 850 DA)" /></Field>
              <Field label="Emplacement"><Input value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })} placeholder="Ex : Rayon 1" /></Field>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={photoBusy || savingItem} onClick={closeItem}>Annuler</Button>
                <Button type="submit" disabled={photoBusy || savingItem}>{savingItem ? "Enregistrement…" : editId ? "Enregistrer" : "Ajouter"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[95dvh] overflow-auto sm:max-w-[880px]">
          <DialogHeader><DialogTitle>Bon de vente en gros {wholesale?.number}</DialogTitle></DialogHeader>
          <div className="wg-preview">{wholesale && <WholesaleReceipt t={wholesale} settings={state.settings} />}</div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fermer</Button>
            <Button variant="outline" disabled={pdfBusy} onClick={async () => { if (!wholesale) return; setPdfBusy(true); try { await downloadWholesalePdf(wholesale.number); } catch { toast.error("PDF impossible"); } finally { setPdfBusy(false); } }}><Download className="h-4 w-4" /> {pdfBusy ? "Préparation…" : "Télécharger PDF"}</Button>
            <Button onClick={() => void printWholesaleReceipt().catch(() => toast.error("Impression impossible"))}><Printer className="h-4 w-4" /> Imprimer A5</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WholesalePrintPortal t={wholesale} settings={state.settings} />
      <TicketPrintPortal t={ticket} settings={state.settings} />
    </div>
  );
}

function BarcodeAdmin({ items, onSaved }: { items: Item[]; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  async function save(i: Item) {
    const v = fixScan(String(vals[i.id] ?? i.barcode ?? "").trim());
    try { await api.update("stock_items", i.id, { barcode: v || null }); }
    catch (e) { toast.error(/duplicate|unique/i.test(e instanceof Error ? e.message : "") ? "Ce code-barres est déjà utilisé." : "Enregistrement impossible."); return; }
    toast.success("Code-barres enregistré");
    onSaved();
  }
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2 p-4">
      <p className="text-sm text-muted-foreground">Cliquez dans la case du produit, scannez son code-barres, puis Entrée.</p>
      {items.map((i) => (
        <form key={i.id} onSubmit={(e) => { e.preventDefault(); void save(i); }} className="card-surface flex items-center gap-3 p-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.name}</span>
          <Input className="w-56" value={String(vals[i.id] ?? i.barcode ?? "")} onChange={(e) => setVals({ ...vals, [i.id]: e.target.value })} placeholder="Code-barres" />
          <Button type="submit" size="sm">Enregistrer</Button>
        </form>
      ))}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Field } from "@/components/common/Field";
import { StatusBadge, paymentTone } from "@/components/common/StatusBadge";
import { selectClass } from "@/components/common/select-class";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { acquireLock, releaseLock } from "@/lib/locks";
import { useApp } from "@/context/AppContext";
import { formatDA, formatDate, formatNumber, nextNumber, todayISO, uid } from "@/lib/format";
import type { PaymentMode, Sale, StockUnit } from "@/lib/types";

export const Route = createFileRoute("/ventes")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Ventes — Medjadja Olive" },
      {
        name: "description",
        content: "Enregistrez les ventes d'huile d'olive, paiements et restes à payer.",
      },
      { property: "og:title", content: "Ventes — Medjadja Olive" },
      { property: "og:description", content: "Ventes, encaissements et reçus clients." },
    ],
  }),
  component: SalesPage,
});

const PAYMENT_MODES: PaymentMode[] = ["espèces", "virement", "chèque", "autre"];

function SalesPage() {
  const { state, add, update, remove, log, canEdit } = useApp();
  const editable = canEdit("sales");
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("tous");
  const [dateFilter, setDateFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Sale | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open && editId) void releaseLock("sales", editId);
  }, [open, editId]);

  const emptyForm = {
    date: todayISO(),
    customerId: state.customers[0]?.id ?? "",
    itemId: state.stockItems[0]?.id ?? "",
    quantity: "",
    unit: "L" as StockUnit,
    unitPrice: "",
    paid: "",
    paymentMode: "espèces" as PaymentMode,
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const total = (Number(form.quantity) || 0) * (Number(form.unitPrice) || 0);
  const remaining = total - (Number(form.paid) || 0);

  const customerName = (id: string) => state.customers.find((c) => c.id === id)?.name ?? "—";
  const itemName = (id: string) => state.stockItems.find((i) => i.id === id)?.name ?? "—";

  const rows = useMemo(
    () =>
      state.sales
        .filter((s) => {
          const q = query.trim().toLowerCase();
          return (
            (!q ||
              `${s.number} ${customerName(s.customerId)} ${itemName(s.itemId)}`
                .toLowerCase()
                .includes(q)) &&
            (customerFilter === "tous" || s.customerId === customerFilter) &&
            (!dateFilter || s.date === dateFilter)
          );
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.sales, state.customers, state.stockItems, query, customerFilter, dateFilter],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.customerId) errs['customerId'] = "Sélectionnez un client.";
    if (!form.itemId) errs['itemId'] = "Sélectionnez un produit.";
    if (!(Number(form.quantity) > 0)) errs['quantity'] = "Quantité invalide.";
    if (!(Number(form.unitPrice) > 0)) errs['unitPrice'] = "Prix unitaire invalide.";
    if (Number(form.paid) < 0 || Number(form.paid) > total) errs['paid'] = "Montant payé invalide.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      date: form.date,
      customerId: form.customerId,
      itemId: form.itemId,
      quantity: Number(form.quantity),
      unit: form.unit,
      unitPrice: Number(form.unitPrice),
      total,
      paid: Number(form.paid) || 0,
      remaining,
      paymentMode: form.paymentMode,
      notes: form.notes,
      saleType: "HUILE" as const,
    };

    if (editId) {
      if (!(await update("sales", editId, payload))) return;
      log("a modifié une vente", "Ventes", editId);
      toast.success("Vente modifiée");
    } else {
      const sale: Sale = {
        ...payload,
        id: uid(),
        number: nextNumber(
          "VTE",
          state.sales.map((s) => s.number),
        ),
      };
      if (!(await add("sales", sale))) return;
      log("a enregistré une vente", "Ventes", sale.number);
      toast.success(`Vente ${sale.number} enregistrée — ${formatDA(sale.total)}`);
    }
    setOpen(false);
  }

  const ca = rows.reduce((s, v) => s + v.total, 0);
  const due = rows.reduce((s, v) => s + v.remaining, 0);

  return (
    <AppShell module="sales">
      <PageHeader
        title="Ventes"
        subtitle={`${rows.length} vente(s) — ${formatDA(ca)} · reste à encaisser ${formatDA(due)}`}
        actions={
          editable && (
            <Button
              onClick={() => {
                setForm(emptyForm);
                setEditId(null);
                setErrors({});
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nouvelle vente
            </Button>
          )
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="N°, client, produit…"
              className="pl-9"
            />
          </div>
          <select
            className={selectClass}
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="tous">Tous les clients</option>
            {state.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Aucune vente"
            description="Enregistrez votre première vente d'huile."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Reste</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const status = paymentTone(s.remaining, s.total);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.number}</TableCell>
                      <TableCell>{formatDate(s.date)}</TableCell>
                      <TableCell>{customerName(s.customerId)}</TableCell>
                      <TableCell>{itemName(s.itemId)}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(s.quantity, 0)} {s.unit}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatDA(s.total)}</TableCell>
                      <TableCell className="text-right">{formatDA(s.remaining)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setReceipt(s)}>
                            Reçu
                          </Button>
                          {editable && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (!(await acquireLock("sales", s.id))) return;
                                  setForm({
                                    date: s.date,
                                    customerId: s.customerId,
                                    itemId: s.itemId,
                                    quantity: String(s.quantity),
                                    unit: s.unit,
                                    unitPrice: String(s.unitPrice),
                                    paid: String(s.paid),
                                    paymentMode: s.paymentMode,
                                    notes: s.notes,
                                  });
                                  setEditId(s.id);
                                  setErrors({});
                                  setOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setToDelete(s)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier la vente" : "Nouvelle vente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="Client *" error={errors['customerId']}>
                <select
                  className={selectClass}
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                >
                  <option value="">— Choisir —</option>
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Produit *" error={errors['itemId']}>
                <select
                  className={selectClass}
                  value={form.itemId}
                  onChange={(e) => {
                    const item = state.stockItems.find((i) => i.id === e.target.value);
                    setForm({ ...form, itemId: e.target.value, unit: item?.unit ?? form.unit });
                  }}
                >
                  <option value="">— Choisir —</option>
                  {state.stockItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unité">
                <select
                  className={selectClass}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as StockUnit })}
                >
                  <option value="L">L</option>
                  <option value="kg">kg</option>
                  <option value="unité">unité</option>
                  <option value="carton">carton</option>
                </select>
              </Field>
              <Field label="Quantité *" error={errors['quantity']}>
                <Input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </Field>
              <Field label="Prix unitaire (DA) *" error={errors['unitPrice']}>
                <Input
                  type="number"
                  min="0"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                />
              </Field>
              <Field label="Montant payé (DA)" error={errors['paid']}>
                <Input
                  type="number"
                  min="0"
                  value={form.paid}
                  onChange={(e) => setForm({ ...form, paid: e.target.value })}
                />
              </Field>
              <Field label="Mode de paiement">
                <select
                  className={selectClass}
                  value={form.paymentMode}
                  onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 rounded-xl bg-secondary/70 px-4 py-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-display text-xl font-semibold">{formatDA(total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reste à payer</p>
                <p className="font-display text-xl font-semibold">{formatDA(remaining)}</p>
              </div>
            </div>
            <Field label="Notes">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editId ? "Enregistrer" : "Valider la vente"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reçu {receipt?.number}</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-border p-4">
                <p className="font-display text-base font-semibold">{state.settings.companyName}</p>
                <p className="text-muted-foreground">
                  {state.settings.address} — {state.settings.wilaya}
                </p>
                <p className="text-muted-foreground">Tél. {state.settings.phone}</p>
              </div>
              <div className="space-y-1">
                <p>
                  <span className="text-muted-foreground">Date : </span>
                  {formatDate(receipt.date)}
                </p>
                <p>
                  <span className="text-muted-foreground">Client : </span>
                  {customerName(receipt.customerId)}
                </p>
                <p>
                  <span className="text-muted-foreground">Produit : </span>
                  {itemName(receipt.itemId)}
                </p>
                <p>
                  <span className="text-muted-foreground">Quantité : </span>
                  {formatNumber(receipt.quantity, 0)} {receipt.unit} × {formatDA(receipt.unitPrice)}
                </p>
              </div>
              <div className="space-y-1 border-t border-border pt-3">
                <p className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatDA(receipt.total)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Payé ({receipt.paymentMode})</span>
                  <span>{formatDA(receipt.paid)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Reste</span>
                  <span>{formatDA(receipt.remaining)}</span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        label={`la vente ${toDelete?.number}`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("sales", toDelete.id))) return;
          log("a supprimé une vente", "Ventes", toDelete.number);
          toast.success("Vente supprimée");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

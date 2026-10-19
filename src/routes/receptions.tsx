import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileDown,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Field } from "@/components/common/Field";
import { StatusBadge } from "@/components/common/StatusBadge";
import { selectClass } from "@/components/common/select-class";
import { FarmerPicker } from "@/components/reception/FarmerPicker";
import { FarmerSheet } from "@/components/reception/FarmerSheet";
import { InlineFarmerForm } from "@/components/reception/InlineFarmerForm";
import {
  ReceiptContent,
  ReceiptPrintPortal,
  type ReceiptData,
} from "@/components/reception/ReceptionReceipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/context/AppContext";
import { formatDA, formatDate, formatNumber, nowTime, todayISO, uid } from "@/lib/format";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import {
  CHOICE_BADGES,
  CHOICE_LABELS,
  PAYMENT_STATUS_LABELS,
  TRANSFORM_LABELS,
  hasTransform,
  isPayable,
} from "@/lib/reception-choice";
import type { ClientChoice, PaymentStatus, Reception, Supplier } from "@/lib/types";

export const Route = createFileRoute("/receptions")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Réception des olives — Medjadja Olive" },
      {
        name: "description",
        content: "Enregistrez les livraisons d'olives : poids, variété, prix au kg et montant total.",
      },
      { property: "og:title", content: "Réception des olives — Medjadja Olive" },
      { property: "og:description", content: "Suivi des réceptions d'olives par fournisseur." },
    ],
  }),
  component: ReceptionsPage,
});

const PAY_TONES: Record<PaymentStatus, "success" | "warning" | "danger"> = {
  PAYÉ: "success",
  PARTIELLEMENT_PAYÉ: "warning",
  NON_PAYÉ: "danger",
};

function ReceptionsPage() {
  const { state, add, update, remove, log, canEdit } = useApp();
  const editable = canEdit("receptions");
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("tous");
  const [dateFilter, setDateFilter] = useState("");
  const [choiceFilter, setChoiceFilter] = useState("tous");
  const [payFilter, setPayFilter] = useState("tous");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Reception | null>(null);
  const [toCancel, setToCancel] = useState<Reception | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [postSave, setPostSave] = useState<ReceiptData | null>(null);
  const [viewData, setViewData] = useState<ReceiptData | null>(null);
  const [receiptFor, setReceiptFor] = useState<ReceiptData | null>(null);
  const [farmer, setFarmer] = useState<Supplier | null>(null);

  const emptyForm = {
    date: todayISO(),
    time: nowTime(),
    supplierId: "",
    weightKg: "",
    variety: "Chemlal",
    origin: "",
    pricePerKg: "",
    clientChoice: "NON_RENSEIGNE" as ClientChoice,
    soldKg: "",
    oilKg: "",
    payStatus: "NON_PAYÉ" as PaymentStatus,
    paidAmount: "",
    condition: "Bon" as Reception["condition"],
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  // Calculs locaux (le serveur refait les mêmes de façon fiable)
  const weight = Number(form.weightKg) || 0;
  const price = Number(form.pricePerKg) || 0;
  const soldEff =
    form.clientChoice === "VENTE_OLIVES"
      ? weight
      : form.clientChoice === "MIXTE"
        ? Number(form.soldKg) || 0
        : 0;
  const oilEff =
    form.clientChoice === "TRANSFORMATION_HUILE"
      ? weight
      : form.clientChoice === "MIXTE"
        ? Number(form.oilKg) || 0
        : 0;
  const total = form.clientChoice === "NON_RENSEIGNE" ? weight * price : soldEff * price;
  const paid =
    !isPayable(form.clientChoice) || form.payStatus === "NON_PAYÉ"
      ? 0
      : form.payStatus === "PAYÉ"
        ? total
        : Number(form.paidAmount) || 0;
  const remaining = total - paid;
  const mixteValid = form.clientChoice !== "MIXTE" || soldEff + oilEff === weight;

  const supplierName = (id: string) => state.suppliers.find((s) => s.id === id)?.name ?? "—";
  const supplierPhone = (id: string) => state.suppliers.find((s) => s.id === id)?.phone ?? "";
  const mkData = (r: Reception): ReceiptData => ({
    reception: r,
    supplier: state.suppliers.find((s) => s.id === r.supplierId),
  });

  // Impression : montre uniquement le reçu, ouvre le dialogue d'impression, puis nettoie.
  const printedRef = useRef<ReceiptData | null>(null);
  useEffect(() => {
    if (!receiptFor) return;
    const current = receiptFor;
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      document.body.classList.remove("print-receipt");
      window.removeEventListener("afterprint", cleanup);
      printedRef.current = null;
      // N'efface que ce reçu : un reçu plus récent ne doit pas être annulé.
      setReceiptFor((cur) => (cur === current ? null : cur));
    };
    document.body.classList.add("print-receipt");
    window.addEventListener("afterprint", cleanup);
    const t = setTimeout(() => {
      if (printedRef.current === receiptFor) return; // une seule ouverture par reçu
      printedRef.current = receiptFor;
      window.print();
    }, 80);
    const fallback = setTimeout(cleanup, 60000);
    return () => {
      clearTimeout(t);
      clearTimeout(fallback);
      cleanup();
    };
  }, [receiptFor]);

  const rows = useMemo(
    () =>
      state.receptions
        .filter((r) => {
          const q = query.trim().toLowerCase();
          const matches =
            !q ||
            `${r.number} ${supplierName(r.supplierId)} ${r.variety} ${r.origin}`
              .toLowerCase()
              .includes(q);
          return (
            matches &&
            (supplierFilter === "tous" || r.supplierId === supplierFilter) &&
            (!dateFilter || r.date === dateFilter) &&
            (choiceFilter === "tous" || r.clientChoice === choiceFilter) &&
            (payFilter === "tous" ||
              (payFilter === "paye" && r.paymentStatus === "PAYÉ") ||
              (payFilter === "partiel" && r.paymentStatus === "PARTIELLEMENT_PAYÉ") ||
              (payFilter === "nonpaye" && r.paymentStatus === "NON_PAYÉ" && isPayable(r.clientChoice))) &&
            (!pendingOnly || (r.clientChoice === "NON_RENSEIGNE" && !r.cancelled))
          );
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.receptions, state.suppliers, query, supplierFilter, dateFilter, choiceFilter, payFilter, pendingOnly],
  );

  function startNewReception() {
    setPostSave(null);
    setViewData(null);
    setForm({
      ...emptyForm,
      date: todayISO(),
      time: nowTime(),
      pricePerKg: state.settings.dailyPrice > 0 ? String(state.settings.dailyPrice) : "",
    });
    setEditId(null);
    setErrors({});
    setOpen(true);
  }

  function startEdit(r: Reception) {
    setForm({
      date: r.date,
      time: r.time,
      supplierId: r.supplierId,
      weightKg: String(r.weightKg),
      variety: r.variety,
      origin: r.origin,
      pricePerKg: String(r.pricePerKg),
      clientChoice: r.clientChoice,
      soldKg: r.clientChoice === "MIXTE" ? String(r.soldKg) : "",
      oilKg: r.clientChoice === "MIXTE" ? String(r.oilKg) : "",
      payStatus: r.paymentStatus,
      paidAmount: r.paymentStatus === "PARTIELLEMENT_PAYÉ" ? String(r.paid) : "",
      condition: r.condition,
      notes: r.notes,
    });
    setEditId(r.id);
    setErrors({});
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.supplierId) errs["supplierId"] = "Sélectionnez un agriculteur.";
    if (!(weight > 0)) errs["weightKg"] = "Le poids doit être supérieur à 0.";
    if (price < 0) errs["pricePerKg"] = "Prix invalide.";
    if (form.clientChoice === "MIXTE" && !mixteValid)
      errs["soldKg"] = "Partie vendue + partie huile doit être égale au poids total.";
    if (isPayable(form.clientChoice) && form.payStatus === "PARTIELLEMENT_PAYÉ" && !(paid > 0 && paid < total))
      errs["paidAmount"] = "Le montant payé doit être compris entre 0 et le total.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const paymentStatus: PaymentStatus =
      !isPayable(form.clientChoice) || total <= 0
        ? "NON_PAYÉ"
        : remaining <= 0
          ? "PAYÉ"
          : paid > 0
            ? "PARTIELLEMENT_PAYÉ"
            : "NON_PAYÉ";

    const payload = {
      date: form.date,
      time: form.time,
      supplierId: form.supplierId,
      weightKg: weight,
      variety: form.variety,
      origin: form.origin,
      pricePerKg: price,
      clientChoice: form.clientChoice,
      soldKg: soldEff,
      oilKg: oilEff,
      paid,
      condition: form.condition,
      notes: form.notes,
    };

    if (editId) {
      const before = state.receptions.find((r) => r.id === editId);
      if (!(await update("receptions", editId, payload))) return;
      if (before && before.clientChoice !== form.clientChoice)
        log("a modifié le choix client d'une réception", "Réception olives", before.number);
      else log("a modifié une réception", "Réception olives", editId);
      toast.success("Réception modifiée");
      setOpen(false);
      return;
    }

    const reception: Reception = {
      ...payload,
      id: uid(),
      number: "",
      total,
      remaining,
      paymentStatus,
      transformStatus: "EN_ATTENTE",
      cancelled: false,
    };
    if (!(await add("receptions", reception))) return;
    log("a enregistré une réception", "Réception olives", reception.number);
    toast.success(`Réception ${reception.number} enregistrée avec succès`);
    setOpen(false);
    const data = mkData({ ...reception });
    setPostSave(data);
    if (state.settings.autoPrintReceipt) setReceiptFor(data);
  }

  /** Une réception liée (paiement, production) ne se supprime plus : elle s'annule. */
  const isLinked = (r: Reception) =>
    r.paid > 0 || state.productions.some((p) => p.receptionId === r.id);

  const activeRows = rows.filter((r) => !r.cancelled);
  const totalWeight = activeRows.reduce((s, r) => s + r.weightKg, 0);
  const totalAmount = activeRows.reduce((s, r) => s + r.total, 0);

  return (
    <AppShell module="receptions">
      <PageHeader
        title="Réception des olives"
        subtitle={`${formatNumber(totalWeight, 0)} kg — ${formatDA(totalAmount)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer
            </Button>
            {editable && (
              <Button onClick={startNewReception}>
                <Plus className="mr-1.5 h-4 w-4" /> Nouvelle réception
              </Button>
            )}
          </>
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="N°, agriculteur, variété…"
              className="pl-9"
            />
          </div>
          <select
            className={selectClass}
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="tous">Tous les agriculteurs</option>
            {state.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <select
            className={selectClass}
            value={choiceFilter}
            onChange={(e) => setChoiceFilter(e.target.value)}
            aria-label="Filtrer par choix client"
          >
            <option value="tous">Tous les choix</option>
            <option value="VENTE_OLIVES">Vente olives</option>
            <option value="TRANSFORMATION_HUILE">Transformation huile</option>
            <option value="MIXTE">Mixte</option>
            <option value="NON_RENSEIGNE">Non renseigné</option>
          </select>
          <select
            className={selectClass}
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
            aria-label="Filtrer par paiement"
          >
            <option value="tous">Tous paiements</option>
            <option value="paye">Payé</option>
            <option value="partiel">Partiellement payé</option>
            <option value="nonpaye">Non payé</option>
          </select>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Décision en attente
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Aucune réception"
            description="Enregistrez la première livraison d'olives de la campagne."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Agriculteur</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead>Choix client</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.cancelled ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">{r.number}</TableCell>
                    <TableCell>
                      {formatDate(r.date)}
                      <span className="block text-xs text-muted-foreground">{r.time}</span>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium text-primary hover:underline"
                        onClick={() =>
                          setFarmer(state.suppliers.find((s) => s.id === r.supplierId) ?? null)
                        }
                      >
                        {supplierName(r.supplierId)}
                      </button>
                      {supplierPhone(r.supplierId) && (
                        <span className="block text-xs text-muted-foreground">
                          {supplierPhone(r.supplierId)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(r.weightKg, 0)} kg</TableCell>
                    <TableCell>
                      <StatusBadge tone={r.clientChoice === "NON_RENSEIGNE" ? "warning" : "info"}>
                        {CHOICE_BADGES[r.clientChoice]}
                      </StatusBadge>
                      {hasTransform(r.clientChoice) && !r.cancelled && (
                        <span className="block text-xs text-muted-foreground">
                          {TRANSFORM_LABELS[r.transformStatus]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatDA(r.total)}</TableCell>
                    <TableCell className="text-right">{formatDA(r.paid)}</TableCell>
                    <TableCell>
                      {r.cancelled ? (
                        <StatusBadge tone="neutral">ANNULÉE</StatusBadge>
                      ) : (
                        isPayable(r.clientChoice) && (
                          <StatusBadge tone={PAY_TONES[r.paymentStatus]}>
                            {PAYMENT_STATUS_LABELS[r.paymentStatus]}
                          </StatusBadge>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Voir le reçu ${r.number}`}
                          onClick={() => setViewData(mkData(r))}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Réimprimer le reçu ${r.number} en A5`}
                          onClick={() => setReceiptFor(mkData(r))}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Télécharger le reçu ${r.number} en PDF`}
                          onClick={() => void downloadReceiptPdf(mkData(r), state.settings)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {editable && !r.cancelled && (
                          <>
                            {hasTransform(r.clientChoice) && r.transformStatus === "HUILE_DISPONIBLE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (
                                    !(await update("receptions", r.id, {
                                      transformStatus: "HUILE_RECUPEREE",
                                    }))
                                  )
                                    return;
                                  log("a marqué l'huile récupérée", "Réception olives", r.number);
                                  toast.success(`Huile récupérée — ${r.number}`);
                                }}
                              >
                                Huile récupérée
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Modifier la réception ${r.number}`}
                              onClick={() => startEdit(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isLinked(r) ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Annuler la réception ${r.number}`}
                                onClick={() => setToCancel(r)}
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Supprimer la réception ${r.number}`}
                                onClick={() => setToDelete(r)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Formulaire nouvelle / modification */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier la réception" : "Nouvelle réception"}</DialogTitle>
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
              <Field label="Heure">
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Agriculteur *" error={errors["supplierId"]}>
                  {quickOpen ? (
                    <InlineFarmerForm
                      initialQuery={quickQuery}
                      suppliers={state.suppliers}
                      onCancel={() => setQuickOpen(false)}
                      onDone={(s) => {
                        setForm((f) => ({ ...f, supplierId: s.id }));
                        setQuickOpen(false);
                      }}
                    />
                  ) : (
                    <FarmerPicker
                      suppliers={state.suppliers}
                      value={form.supplierId}
                      onSelect={(s) => setForm((f) => ({ ...f, supplierId: s.id }))}
                      onClear={() => setForm((f) => ({ ...f, supplierId: "" }))}
                      onQuickAdd={(q) => {
                        setQuickQuery(q);
                        setQuickOpen(true);
                      }}
                    />
                  )}
                </Field>
              </div>
              <Field label="Poids (kg) *" error={errors["weightKg"]}>
                <Input
                  type="number"
                  min="0"
                  value={form.weightKg}
                  onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                />
              </Field>
              <Field
                label="Prix / kg (DA)"
                hint={
                  state.settings.dailyPrice > 0
                    ? `Prix du jour : ${formatDA(state.settings.dailyPrice)}/kg`
                    : undefined
                }
                error={errors["pricePerKg"]}
              >
                <Input
                  type="number"
                  min="0"
                  value={form.pricePerKg}
                  onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })}
                />
              </Field>
              <Field label="Variété">
                <Input
                  value={form.variety}
                  onChange={(e) => setForm({ ...form, variety: e.target.value })}
                />
              </Field>
              <Field label="Origine">
                <Input
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Choix du client (facultatif)">
                  <select
                    className={selectClass}
                    value={form.clientChoice}
                    onChange={(e) =>
                      setForm({ ...form, clientChoice: e.target.value as ClientChoice })
                    }
                  >
                    <option value="NON_RENSEIGNE">Non renseigné</option>
                    <option value="VENTE_OLIVES">Vendre les olives</option>
                    <option value="TRANSFORMATION_HUILE">Prendre de l'huile d'olive</option>
                    <option value="MIXTE">Mixte (vente + huile)</option>
                  </select>
                </Field>
              </div>

              {form.clientChoice === "MIXTE" && (
                <>
                  <Field label="Partie vendue (kg)" error={errors["soldKg"]}>
                    <Input
                      type="number"
                      min="0"
                      value={form.soldKg}
                      onChange={(e) => setForm({ ...form, soldKg: e.target.value })}
                    />
                  </Field>
                  <Field label="Partie huile (kg)">
                    <Input
                      type="number"
                      min="0"
                      value={form.oilKg}
                      onChange={(e) => setForm({ ...form, oilKg: e.target.value })}
                    />
                  </Field>
                  {!mixteValid && (
                    <p className="text-sm text-destructive sm:col-span-2">
                      {formatNumber(soldEff + oilEff, 0)} kg ≠ poids total ({formatNumber(weight, 0)} kg)
                    </p>
                  )}
                </>
              )}

              {isPayable(form.clientChoice) && (
                <div className="sm:col-span-2">
                  <Field label="Paiement">
                    <select
                      className={selectClass}
                      value={form.payStatus}
                      onChange={(e) =>
                        setForm({ ...form, payStatus: e.target.value as PaymentStatus })
                      }
                    >
                      <option value="NON_PAYÉ">Non payé</option>
                      <option value="PARTIELLEMENT_PAYÉ">Partiellement payé</option>
                      <option value="PAYÉ">Payé</option>
                    </select>
                  </Field>
                </div>
              )}
              {isPayable(form.clientChoice) && form.payStatus === "PARTIELLEMENT_PAYÉ" && (
                <Field label="Montant payé (DA)" error={errors["paidAmount"]}>
                  <Input
                    type="number"
                    min="0"
                    value={form.paidAmount}
                    onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                  />
                </Field>
              )}
              <Field label="État des olives">
                <select
                  className={selectClass}
                  value={form.condition}
                  onChange={(e) =>
                    setForm({ ...form, condition: e.target.value as Reception["condition"] })
                  }
                >
                  <option value="Bon">Bon</option>
                  <option value="Moyen">Moyen</option>
                  <option value="Mauvais">Mauvais</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-3 rounded-xl bg-secondary/70 px-4 py-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {form.clientChoice === "NON_RENSEIGNE"
                    ? "Montant estimé"
                    : form.clientChoice === "TRANSFORMATION_HUILE"
                      ? "Destination"
                      : "Montant total (partie vendue)"}
                </p>
                <p className="font-display text-xl font-semibold">
                  {form.clientChoice === "TRANSFORMATION_HUILE"
                    ? "Transformation en huile"
                    : formatDA(total)}
                </p>
              </div>
              {isPayable(form.clientChoice) && (
                <div>
                  <p className="text-xs text-muted-foreground">Reste à payer</p>
                  <p className="font-display text-xl font-semibold">{formatDA(remaining)}</p>
                </div>
              )}
            </div>

            <Field label="Notes">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editId ? "Enregistrer" : "Enregistrer la réception"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* Fiche agriculteur */}
      <FarmerSheet supplier={farmer} receptions={state.receptions} onClose={() => setFarmer(null)} />

      {/* Actions après enregistrement */}
      <Dialog open={!!postSave} onOpenChange={(o) => !o && setPostSave(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Réception enregistrée avec succès
            </DialogTitle>
          </DialogHeader>
          {postSave && (
            <div className="rounded-xl bg-secondary/70 px-4 py-3 text-sm">
              <p className="font-display text-lg font-semibold">{postSave.reception.number}</p>
              <p className="text-muted-foreground">
                {postSave.supplier?.name ?? "—"} — {formatNumber(postSave.reception.weightKg, 0)} kg
                — {CHOICE_LABELS[postSave.reception.clientChoice]}
                {isPayable(postSave.reception.clientChoice) &&
                  ` — ${formatDA(postSave.reception.total)}`}
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Button onClick={() => postSave && setReceiptFor(postSave)}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer A5
            </Button>
            <Button
              variant="outline"
              onClick={() => postSave && void downloadReceiptPdf(postSave, state.settings)}
            >
              <FileDown className="mr-1.5 h-4 w-4" /> Télécharger PDF
            </Button>
            <Button variant="outline" onClick={startNewReception}>
              <Plus className="mr-1.5 h-4 w-4" /> Nouvelle réception
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (postSave) setViewData(postSave);
                setPostSave(null);
              }}
            >
              <Eye className="mr-1.5 h-4 w-4" /> Voir la réception
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPostSave(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aperçu du reçu (depuis l'historique) */}
      <Dialog open={!!viewData} onOpenChange={(o) => !o && setViewData(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reçu {viewData?.reception.number}</DialogTitle>
          </DialogHeader>
          {viewData && (
            <div className="overflow-hidden rounded-lg border border-border">
              <ReceiptContent data={viewData} settings={state.settings} />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => viewData && void downloadReceiptPdf(viewData, state.settings)}
            >
              <FileDown className="mr-1.5 h-4 w-4" /> Télécharger PDF
            </Button>
            <Button onClick={() => viewData && setReceiptFor(viewData)}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer A5
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptPrintPortal data={receiptFor} settings={state.settings} />

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        label={`la réception ${toDelete?.number}`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("receptions", toDelete.id))) return;
          log("a supprimé une réception", "Réception olives", toDelete.number);
          toast.success("Réception supprimée");
          setToDelete(null);
        }}
      />

      <ConfirmDelete
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        label={`la réception ${toCancel?.number} (annulation avec traçabilité, le mouvement de caisse associé sera retiré)`}
        title="Confirmer l'annulation"
        confirmLabel="Annuler la réception"
        onConfirm={async () => {
          if (!toCancel) return;
          if (!(await update("receptions", toCancel.id, { cancelled: true }))) return;
          log("a annulé une réception", "Réception olives", toCancel.number);
          toast.success(`Réception ${toCancel.number} annulée`);
          setToCancel(null);
        }}
      />
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Factory, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Field } from "@/components/common/Field";
import { selectClass } from "@/components/common/select-class";
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
import { formatDate, formatNumber, nextNumber, todayISO, uid } from "@/lib/format";
import type { Production } from "@/lib/types";

export const Route = createFileRoute("/production")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Production — Medjadja Olive" },
      {
        name: "description",
        content: "Suivi des lots de trituration : olives pressées, huile obtenue et rendement.",
      },
      { property: "og:title", content: "Production — Medjadja Olive" },
      { property: "og:description", content: "Lots de production et rendement de l'huile d'olive." },
    ],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  const { state, add, update, remove, log, canEdit } = useApp();
  const editable = canEdit("production");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Production | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emptyForm = {
    date: todayISO(),
    receptionId: state.receptions[0]?.id ?? "",
    olivesKg: "",
    oilLiters: "",
    byproductsKg: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const yieldPct =
    Number(form.olivesKg) > 0 ? (Number(form.oilLiters) / Number(form.olivesKg)) * 100 : 0;

  const receptionLabel = (id: string) => {
    const r = state.receptions.find((x) => x.id === id);
    if (!r) return "—";
    const s = state.suppliers.find((y) => y.id === r.supplierId);
    return `${r.number} · ${s?.name ?? ""}`;
  };

  const rows = useMemo(
    () =>
      state.productions
        .filter((p) => {
          const q = query.trim().toLowerCase();
          return !q || `${p.number} ${receptionLabel(p.receptionId)}`.toLowerCase().includes(q);
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.productions, state.receptions, query],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.receptionId) errs['receptionId'] = "Sélectionnez la réception associée.";
    if (!(Number(form.olivesKg) > 0)) errs['olivesKg'] = "Quantité d'olives invalide.";
    if (!(Number(form.oilLiters) > 0)) errs['oilLiters'] = "Quantité d'huile invalide.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      date: form.date,
      receptionId: form.receptionId,
      olivesKg: Number(form.olivesKg),
      oilLiters: Number(form.oilLiters),
      byproductsKg: Number(form.byproductsKg) || 0,
      yieldPct: Number(yieldPct.toFixed(2)),
      notes: form.notes,
    };

    if (editId) {
      if (!(await update("productions", editId, payload))) return;
      log("a modifié un lot de production", "Production", editId);
      toast.success("Production modifiée");
    } else {
      const production: Production = {
        ...payload,
        id: uid(),
        number: nextNumber(
          "PROD",
          state.productions.map((p) => p.number),
        ),
      };
      if (!(await add("productions", production))) return;
      log("a validé une production", "Production", production.number);
      toast.success(
        `Production ${production.number} validée — stock huile +${formatNumber(production.oilLiters, 0)} L`,
      );
    }
    setOpen(false);
  }

  const totalOil = rows.reduce((s, p) => s + p.oilLiters, 0);
  const totalOlives = rows.reduce((s, p) => s + p.olivesKg, 0);
  const avgYield = totalOlives > 0 ? (totalOil / totalOlives) * 100 : 0;

  return (
    <AppShell module="production">
      <PageHeader
        title="Production"
        subtitle={`${formatNumber(totalOil, 0)} L produits — rendement moyen ${formatNumber(avgYield, 1)} %`}
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
              <Plus className="mr-1.5 h-4 w-4" /> Nouveau lot
            </Button>
          )
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="relative sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="N° de lot ou réception…"
              className="pl-9"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="Aucune production"
            description="Créez un lot à partir d'une réception d'olives."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Réception</TableHead>
                  <TableHead className="text-right">Olives</TableHead>
                  <TableHead className="text-right">Huile</TableHead>
                  <TableHead className="text-right">Rendement</TableHead>
                  <TableHead className="text-right">Sous-produits</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.number}</TableCell>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell>{receptionLabel(p.receptionId)}</TableCell>
                    <TableCell className="text-right">{formatNumber(p.olivesKg, 0)} kg</TableCell>
                    <TableCell className="text-right">{formatNumber(p.oilLiters, 0)} L</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatNumber(p.yieldPct, 2)} %
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(p.byproductsKg, 0)} kg
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {editable && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setForm({
                                  date: p.date,
                                  receptionId: p.receptionId,
                                  olivesKg: String(p.olivesKg),
                                  oilLiters: String(p.oilLiters),
                                  byproductsKg: String(p.byproductsKg),
                                  notes: p.notes,
                                });
                                setEditId(p.id);
                                setErrors({});
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setToDelete(p)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier le lot" : "Nouveau lot de production"}</DialogTitle>
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
              <Field label="Réception associée *" error={errors['receptionId']}>
                <select
                  className={selectClass}
                  value={form.receptionId}
                  onChange={(e) => setForm({ ...form, receptionId: e.target.value })}
                >
                  <option value="">— Choisir —</option>
                  {state.receptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {receptionLabel(r.id)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Olives pressées (kg) *" error={errors['olivesKg']}>
                <Input
                  type="number"
                  min="0"
                  value={form.olivesKg}
                  onChange={(e) => setForm({ ...form, olivesKg: e.target.value })}
                />
              </Field>
              <Field label="Huile obtenue (L) *" error={errors['oilLiters']}>
                <Input
                  type="number"
                  min="0"
                  value={form.oilLiters}
                  onChange={(e) => setForm({ ...form, oilLiters: e.target.value })}
                />
              </Field>
              <Field label="Sous-produits (kg)" hint="Grignons, margines…">
                <Input
                  type="number"
                  min="0"
                  value={form.byproductsKg}
                  onChange={(e) => setForm({ ...form, byproductsKg: e.target.value })}
                />
              </Field>
            </div>
            <div className="rounded-xl bg-secondary/70 px-4 py-3">
              <p className="text-xs text-muted-foreground">Rendement calculé</p>
              <p className="font-display text-xl font-semibold">{formatNumber(yieldPct, 2)} %</p>
            </div>
            <Field label="Observations">
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
              <Button type="submit">{editId ? "Enregistrer" : "Valider la production"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        label={`le lot ${toDelete?.number}`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("productions", toDelete.id))) return;
          log("a supprimé un lot de production", "Production", toDelete.number);
          toast.success("Lot supprimé");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Banknote, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Field } from "@/components/common/Field";
import { KpiCard } from "@/components/common/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { useApp } from "@/context/AppContext";
import { formatDA, formatDate, nowTime, todayISO, uid } from "@/lib/format";
import type { CashMovement } from "@/lib/types";

export const Route = createFileRoute("/caisse")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Caisse — Medjadja Olive" },
      {
        name: "description",
        content: "Suivez les entrées et sorties d'argent : ventes, achats d'olives, dépenses et apports.",
      },
      { property: "og:title", content: "Caisse — Medjadja Olive" },
      { property: "og:description", content: "Mouvements de caisse de l'unité d'huile d'olive." },
    ],
  }),
  component: CaissePage,
});


function CaissePage() {
  const { state, add, remove, log, canEdit } = useApp();
  const editable = canEdit("caisse");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [dateFilter, setDateFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CashMovement | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emptyForm = {
    date: todayISO(),
    time: nowTime(),
    type: "ENTREE" as CashMovement["type"],
    amount: "",
    source: "",
    sourceCustom: "",
    motive: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const userName = (id: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}`.trim() || u.email : "—";
  };

  const rows = useMemo(
    () =>
      state.cashMovements
        .filter((m) => {
          const q = query.trim().toLowerCase();
          return (
            (!q ||
              `${m.number} ${m.source} ${m.motive} ${m.reference} ${m.notes}`
                .toLowerCase()
                .includes(q)) &&
            (typeFilter === "tous" || m.type === typeFilter) &&
            (!dateFilter || m.date === dateFilter)
          );
        })
        .sort((a, b) => (a.date === b.date ? (a.number < b.number ? 1 : -1) : a.date < b.date ? 1 : -1)),
    [state.cashMovements, query, typeFilter, dateFilter],
  );

  const totalIn = state.cashMovements.filter((m) => m.type === "ENTREE").reduce((s, m) => s + m.amount, 0);
  const totalOut = state.cashMovements.filter((m) => m.type === "SORTIE").reduce((s, m) => s + m.amount, 0);
  const solde = totalIn - totalOut;
  const periodIn = rows.filter((m) => m.type === "ENTREE").reduce((s, m) => s + m.amount, 0);
  const periodOut = rows.filter((m) => m.type === "SORTIE").reduce((s, m) => s + m.amount, 0);

  const today = todayISO();
  const todayRows = state.cashMovements.filter((m) => m.date === today);
  const todayIn = todayRows.filter((m) => m.type === "ENTREE").reduce((s, m) => s + m.amount, 0);
  const todayExpenses = todayRows
    .filter((m) => m.type === "SORTIE" && /dépense/i.test(m.source))
    .reduce((s, m) => s + m.amount, 0);
  const todayOut = todayRows.filter((m) => m.type === "SORTIE").reduce((s, m) => s + m.amount, 0);
  const todayRest = todayIn - todayOut;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!(Number(form.amount) > 0)) errs["amount"] = "Le montant doit être supérieur à 0.";
    const source = form.source.trim();
    if (!source) errs["source"] = "Précisez la source de l'argent.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const movement: CashMovement = {
      id: uid(),
      number: "",
      date: form.date,
      time: form.time,
      type: form.type,
      amount: Number(form.amount),
      source,
      motive: form.motive.trim(),
      reference: "",
      userId: "",
      notes: form.notes.trim(),
    };
    if (!(await add("cashMovements", movement))) return;
    log(
      form.type === "ENTREE" ? "a enregistré une entrée de caisse" : "a enregistré une sortie de caisse",
      "Caisse",
      movement.number || source,
    );
    toast.success(
      `${form.type === "ENTREE" ? "Entrée" : "Sortie"} ${movement.number} enregistrée — ${formatDA(movement.amount)}`,
    );
    setOpen(false);
  }

  return (
    <AppShell module="caisse">
      <PageHeader
        title="Caisse"
        subtitle="D'où vient l'argent et où il part"
        actions={
          editable && (
            <Button
              onClick={() => {
                setForm({ ...emptyForm, date: todayISO(), time: nowTime() });
                setErrors({});
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nouveau mouvement
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Banknote} label="Solde actuel" value={formatDA(solde)} tone="primary" />
        <KpiCard icon={ArrowDownLeft} label="Entrées (filtrées)" value={formatDA(periodIn)} tone="success" />
        <KpiCard icon={ArrowUpRight} label="Sorties (filtrées)" value={formatDA(periodOut)} tone="destructive" />
      </div>

      <div className="card-surface mb-6 p-4">
        <p className="mb-3 text-sm font-medium">Résumé du jour ({formatDate(today)})</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Entrées du jour</p>
            <p className="font-display text-lg font-semibold text-success">+ {formatDA(todayIn)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dépenses du jour</p>
            <p className="font-display text-lg font-semibold text-destructive">− {formatDA(todayExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Autres sorties du jour</p>
            <p className="font-display text-lg font-semibold text-destructive">− {formatDA(todayOut - todayExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reste du jour</p>
            <p className={`font-display text-lg font-semibold ${todayRest >= 0 ? "text-success" : "text-destructive"}`}>
              {formatDA(todayRest)}
            </p>
          </div>
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="N°, source, motif, référence…"
              className="pl-9"
            />
          </div>
          <select className={selectClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="tous">Entrées et sorties</option>
            <option value="ENTREE">Entrées</option>
            <option value="SORTIE">Sorties</option>
          </select>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Aucun mouvement"
            description="Les paiements de ventes, d'olives et les dépenses créent des mouvements automatiquement."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source / Motif</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  {editable && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.number}</TableCell>
                    <TableCell>
                      {formatDate(m.date)}
                      {m.time && <span className="block text-xs text-muted-foreground">{m.time}</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={m.type === "ENTREE" ? "success" : "danger"}>
                        {m.type === "ENTREE" ? "ENTRÉE" : "SORTIE"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{m.source}</p>
                      {m.motive && <p className="text-xs text-muted-foreground">{m.motive}</p>}
                    </TableCell>
                    <TableCell>{m.reference || "—"}</TableCell>
                    <TableCell>{userName(m.userId)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${m.type === "ENTREE" ? "text-success" : "text-destructive"}`}
                    >
                      {m.type === "ENTREE" ? "+" : "−"} {formatDA(m.amount)}
                    </TableCell>
                    {editable && (
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Supprimer le mouvement ${m.number}`}
                            onClick={() => setToDelete(m)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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
            <DialogTitle>Nouveau mouvement de caisse</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <select
                  className={selectClass}
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as CashMovement["type"],
                    })
                  }
                >
                  <option value="ENTREE">Entrée</option>
                  <option value="SORTIE">Sortie</option>
                </select>
              </Field>
              <Field label="Montant (DA) *" error={errors["amount"]}>
                <Input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
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
              <Field
                label={form.type === "ENTREE" ? "Source de l'argent *" : "Destination de l'argent *"}
                error={errors["source"]}
              >
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Ex. Apport Mohamed, vente olives…"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        label={`le mouvement ${toDelete?.number}`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("cashMovements", toDelete.id))) return;
          log("a supprimé un mouvement de caisse", "Caisse", toDelete.number);
          toast.success("Mouvement supprimé");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/context/AppContext";
import { formatDA, formatDate, nextNumber, todayISO, uid } from "@/lib/format";
import type { Expense, ExpenseCategory, PaymentMode } from "@/lib/types";

export const Route = createFileRoute("/depenses")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Dépenses — Medjadja Olive" },
      {
        name: "description",
        content: "Suivi des dépenses de l'unité : électricité, carburant, maintenance, salaires.",
      },
      { property: "og:title", content: "Dépenses — Medjadja Olive" },
      { property: "og:description", content: "Charges et dépenses par catégorie et par période." },
    ],
  }),
  component: ExpensesPage,
});

const CATEGORIES: ExpenseCategory[] = [
  "Électricité",
  "Carburant",
  "Transport",
  "Maintenance",
  "Achat emballages",
  "Salaires",
  "Nettoyage",
  "Pièces de rechange",
  "Autres",
];
const MODES: PaymentMode[] = ["espèces", "virement", "chèque", "autre"];

function ExpensesPage() {
  const { state, add, update, remove, log, canEdit, currentUser } = useApp();
  const editable = canEdit("expenses");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("tous");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emptyForm = {
    date: todayISO(),
    category: "Électricité" as ExpenseCategory,
    description: "",
    amount: "",
    paymentMode: "espèces" as PaymentMode,
  };
  const [form, setForm] = useState(emptyForm);

  const rows = useMemo(
    () =>
      state.expenses
        .filter((e) => {
          const q = query.trim().toLowerCase();
          return (
            (!q || `${e.number} ${e.category} ${e.description}`.toLowerCase().includes(q)) &&
            (category === "tous" || e.category === category) &&
            (!from || e.date >= from) &&
            (!to || e.date <= to)
          );
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.expenses, query, category, from, to],
  );

  const totalAmount = rows.reduce((s, e) => s + e.amount, 0);
  const userName = (id: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "—";
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs['description'] = "La description est obligatoire.";
    if (!(Number(form.amount) > 0)) errs['amount'] = "Montant invalide.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      date: form.date,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      userId: currentUser?.id ?? "",
    };

    if (editId) {
      if (!(await update("expenses", editId, payload))) return;
      log("a modifié une dépense", "Dépenses", form.description);
      toast.success("Dépense modifiée");
    } else {
      const expense: Expense = {
        ...payload,
        id: uid(),
        number: nextNumber(
          "DEP",
          state.expenses.map((x) => x.number),
        ),
      };
      if (!(await add("expenses", expense))) return;
      log("a enregistré une dépense", "Dépenses", expense.number);
      toast.success(`Dépense ${expense.number} enregistrée`);
    }
    setOpen(false);
  }

  return (
    <AppShell module="expenses">
      <PageHeader
        title="Dépenses"
        subtitle={`${rows.length} dépense(s) — ${formatDA(totalAmount)}`}
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
              <Plus className="mr-1.5 h-4 w-4" /> Nouvelle dépense
            </Button>
          )
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="pl-9"
            />
          </div>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="tous">Toutes les catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucune dépense" description="Ajoutez une dépense." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.number}</TableCell>
                    <TableCell>{formatDate(e.date)}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell>{e.paymentMode}</TableCell>
                    <TableCell>{userName(e.userId)}</TableCell>
                    <TableCell className="text-right font-medium">{formatDA(e.amount)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {editable && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setForm({
                                  date: e.date,
                                  category: e.category,
                                  description: e.description,
                                  amount: String(e.amount),
                                  paymentMode: e.paymentMode,
                                });
                                setEditId(e.id);
                                setErrors({});
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setToDelete(e)}>
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
            <DialogTitle>{editId ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
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
              <Field label="Catégorie">
                <select
                  className={selectClass}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Montant (DA) *" error={errors['amount']}>
                <Input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field label="Mode de paiement">
                <select
                  className={selectClass}
                  value={form.paymentMode}
                  onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description *" error={errors['description']}>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editId ? "Enregistrer" : "Ajouter"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        label={`la dépense ${toDelete?.number}`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("expenses", toDelete.id))) return;
          log("a supprimé une dépense", "Dépenses", toDelete.number);
          toast.success("Dépense supprimée");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

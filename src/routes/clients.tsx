import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
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
import { formatDA, formatDate, todayISO, uid } from "@/lib/format";
import type { Customer } from "@/lib/types";

export const Route = createFileRoute("/clients")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Clients — Medjadja Olive" },
      {
        name: "description",
        content: "Fichier clients particuliers et professionnels avec historique des achats.",
      },
      { property: "og:title", content: "Clients — Medjadja Olive" },
      { property: "og:description", content: "Gestion des clients et de leurs achats d'huile." },
    ],
  }),
  component: CustomersPage,
});

const empty: Omit<Customer, "id" | "createdAt"> = {
  name: "",
  company: "",
  phone: "",
  address: "",
  wilaya: "",
  type: "particulier",
  notes: "",
};

function CustomersPage() {
  const { state, add, update, remove, log, canEdit } = useApp();
  const editable = canEdit("customers");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      state.customers.filter((c) => {
        const q = query.trim().toLowerCase();
        const matches = !q || `${c.name} ${c.company} ${c.phone} ${c.wilaya}`.toLowerCase().includes(q);
        return matches && (typeFilter === "tous" || c.type === typeFilter);
      }),
    [state.customers, query, typeFilter],
  );

  const purchases = (id: string) => state.sales.filter((s) => s.customerId === id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs['name'] = "Le nom est obligatoire.";
    if (!form.phone.trim()) errs['phone'] = "Le téléphone est obligatoire.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (editId) {
      if (!(await update("customers", editId, form))) return;
      log("a modifié un client", "Clients", form.name);
      toast.success("Client modifié");
    } else {
      const customer: Customer = { ...form, id: uid(), createdAt: todayISO() };
      if (!(await add("customers", customer))) return;
      log("a ajouté un client", "Clients", customer.name);
      toast.success("Client ajouté");
    }
    setOpen(false);
  }

  return (
    <AppShell module="customers">
      <PageHeader
        title="Clients"
        subtitle={`${state.customers.length} client(s)`}
        actions={
          editable && (
            <Button
              onClick={() => {
                setForm(empty);
                setEditId(null);
                setErrors({});
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Ajouter
            </Button>
          )
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un client…"
              className="pl-9"
            />
          </div>
          <select
            className={`${selectClass} sm:w-48`}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="tous">Tous les types</option>
            <option value="particulier">Particuliers</option>
            <option value="professionnel">Professionnels</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead className="text-right">Total achats</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={c.type === "professionnel" ? "info" : "neutral"}>
                        {c.type}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.wilaya || "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatDA(purchases(c.id).reduce((s, v) => s + v.total, 0))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(c)}>
                          Détails
                        </Button>
                        {editable && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setForm({ ...c });
                                setEditId(c.id);
                                setErrors({});
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}>
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
            <DialogTitle>{editId ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom *" error={errors['name']}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Prénom / Entreprise">
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </Field>
              <Field label="Téléphone *" error={errors['phone']}>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Type">
                <select
                  className={selectClass}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Customer["type"] })}
                >
                  <option value="particulier">Particulier</option>
                  <option value="professionnel">Professionnel</option>
                </select>
              </Field>
              <Field label="Wilaya">
                <Input value={form.wilaya} onChange={(e) => setForm({ ...form, wilaya: e.target.value })} />
              </Field>
              <Field label="Adresse">
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-5">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Entreprise</p>
                  <p className="font-medium">{detail.company || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{detail.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Wilaya</p>
                  <p className="font-medium">{detail.wilaya || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client depuis</p>
                  <p className="font-medium">{formatDate(detail.createdAt)}</p>
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-display text-sm font-semibold">Historique des achats</h3>
                {purchases(detail.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun achat enregistré.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N°</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases(detail.id).map((s) => {
                        const status = paymentTone(s.remaining, s.total);
                        return (
                          <TableRow key={s.id}>
                            <TableCell>{s.number}</TableCell>
                            <TableCell>{formatDate(s.date)}</TableCell>
                            <TableCell className="text-right">{formatDA(s.total)}</TableCell>
                            <TableCell>
                              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        label={`le client « ${toDelete?.name} »`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("customers", toDelete.id))) return;
          log("a supprimé un client", "Clients", toDelete.name);
          toast.success("Client supprimé");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

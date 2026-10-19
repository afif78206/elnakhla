import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Sprout, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Field } from "@/components/common/Field";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { formatDA, formatDate, formatNumber, todayISO, uid } from "@/lib/format";
import type { Supplier } from "@/lib/types";

export const Route = createFileRoute("/fournisseurs")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Fournisseurs & agriculteurs — Medjadja Olive" },
      {
        name: "description",
        content: "Gérez les agriculteurs et fournisseurs d'olives et suivez leurs livraisons.",
      },
      { property: "og:title", content: "Fournisseurs & agriculteurs — Medjadja Olive" },
      { property: "og:description", content: "Fiches fournisseurs et historique des livraisons." },
    ],
  }),
  component: SuppliersPage,
});

const empty: Omit<Supplier, "id" | "createdAt"> = {
  name: "",
  company: "",
  phone: "",
  address: "",
  wilaya: "",
  commune: "",
  type: "agriculteur",
  notes: "",
};

function SuppliersPage() {
  const { state, add, update, remove, log, canEdit } = useApp();
  const editable = canEdit("suppliers");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Supplier | null>(null);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      state.suppliers.filter((s) => {
        const q = query.trim().toLowerCase();
        const matches =
          !q ||
          `${s.name} ${s.company} ${s.phone} ${s.wilaya}`.toLowerCase().includes(q);
        return matches && (typeFilter === "tous" || s.type === typeFilter);
      }),
    [state.suppliers, query, typeFilter],
  );

  function openCreate() {
    setForm(empty);
    setEditId(null);
    setErrors({});
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setForm({ ...s });
    setEditId(s.id);
    setErrors({});
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs['name'] = "Le nom est obligatoire.";
    if (!form.phone.trim()) errs['phone'] = "Le téléphone est obligatoire.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (editId) {
      if (!(await update("suppliers", editId, form))) return;
      log("a modifié un fournisseur", "Fournisseurs", form.name);
      toast.success("Fournisseur modifié");
    } else {
      const supplier: Supplier = { ...form, id: uid(), createdAt: todayISO() };
      if (!(await add("suppliers", supplier))) return;
      log("a ajouté un fournisseur", "Fournisseurs", supplier.name);
      toast.success("Fournisseur ajouté");
    }
    setOpen(false);
  }

  const deliveries = (supplierId: string) =>
    state.receptions.filter((r) => r.supplierId === supplierId);

  return (
    <AppShell module="suppliers">
      <PageHeader
        title="Fournisseurs & agriculteurs"
        subtitle={`${state.suppliers.length} fiche(s) enregistrée(s)`}
        actions={
          editable && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Ajouter
            </Button>
          )
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un nom, téléphone, wilaya…"
              className="pl-9"
            />
          </div>
          <select
            className={`${selectClass} sm:w-48`}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="tous">Tous les types</option>
            <option value="agriculteur">Agriculteurs</option>
            <option value="fournisseur">Fournisseurs</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Sprout}
            title="Aucun fournisseur"
            description="Ajoutez un agriculteur ou un fournisseur pour commencer à enregistrer les livraisons."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead className="text-right">Livraisons</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.name}</p>
                      {s.company && <p className="text-xs text-muted-foreground">{s.company}</p>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={s.type === "agriculteur" ? "info" : "neutral"}>
                        {s.type}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{s.phone}</TableCell>
                    <TableCell>{s.wilaya || "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(
                        deliveries(s.id).reduce((sum, r) => sum + r.weightKg, 0),
                        0,
                      )}{" "}
                      kg
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(s)}>
                          Détails
                        </Button>
                        {editable && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom *" error={errors['name']}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Prénom / Raison sociale">
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
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as Supplier["type"] })
                  }
                >
                  <option value="agriculteur">Agriculteur</option>
                  <option value="fournisseur">Fournisseur</option>
                </select>
              </Field>
              <Field label="Wilaya">
                <Input value={form.wilaya} onChange={(e) => setForm({ ...form, wilaya: e.target.value })} />
              </Field>
              <Field label="Commune">
                <Input
                  value={form.commune}
                  onChange={(e) => setForm({ ...form, commune: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Adresse">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
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
                <Info label="Raison sociale" value={detail.company || "—"} />
                <Info label="Téléphone" value={detail.phone} />
                <Info label="Type" value={detail.type} />
                <Info label="Wilaya" value={detail.wilaya || "—"} />
                <Info label="Commune" value={detail.commune || "—"} />
                <Info label="Adresse" value={detail.address || "—"} />
                <Info label="Créé le" value={formatDate(detail.createdAt)} />
              </div>
              {detail.notes && (
                <p className="rounded-lg bg-secondary/60 p-3 text-sm">{detail.notes}</p>
              )}
              <div>
                <h3 className="mb-2 font-display text-sm font-semibold">Historique des livraisons</h3>
                {deliveries(detail.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune livraison enregistrée.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N°</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Poids</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries(detail.id).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.number}</TableCell>
                          <TableCell>{formatDate(r.date)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(r.weightKg, 0)} kg
                          </TableCell>
                          <TableCell className="text-right">{formatDA(r.total)}</TableCell>
                        </TableRow>
                      ))}
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
        label={`le fournisseur « ${toDelete?.name} »`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("suppliers", toDelete.id))) return;
          log("a supprimé un fournisseur", "Fournisseurs", toDelete.name);
          toast.success("Fournisseur supprimé");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

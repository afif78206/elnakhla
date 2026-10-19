import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeftRight, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/context/AppContext";
import { formatDate, formatNumber, todayISO, uid } from "@/lib/format";
import type { MovementType, StockCategory, StockItem, StockUnit } from "@/lib/types";

export const Route = createFileRoute("/stock")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Stock — Medjadja Olive" },
      {
        name: "description",
        content: "Stock d'huile, bouteilles, bidons et emballages avec alertes de stock faible.",
      },
      { property: "og:title", content: "Stock — Medjadja Olive" },
      { property: "og:description", content: "Articles, quantités et mouvements de stock." },
    ],
  }),
  component: StockPage,
});

const CATEGORIES: StockCategory[] = [
  "Huile en vrac",
  "Bouteilles",
  "Bidons",
  "Bouchons",
  "Cartons",
  "Étiquettes",
  "Autres emballages",
];
const UNITS: StockUnit[] = ["L", "kg", "unité", "carton"];
const MOVEMENT_TYPES: MovementType[] = [
  "entrée",
  "sortie",
  "production",
  "vente",
  "correction",
  "perte",
];

const emptyItem: Omit<StockItem, "id"> = {
  name: "",
  category: "Huile en vrac",
  quantity: 0,
  unit: "L",
  minQuantity: 0,
  location: "",
  updatedAt: todayISO(),
};

function StockPage() {
  const { state, add, update, remove, log, canEdit, adjustStock } = useApp();
  const editable = canEdit("stock");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("tous");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<StockItem, "id">>(emptyItem);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<StockItem | null>(null);

  const [moveOpen, setMoveOpen] = useState(false);
  const [move, setMove] = useState({
    itemId: state.stockItems[0]?.id ?? "",
    type: "entrée" as MovementType,
    quantity: "",
    reference: "",
  });

  const items = useMemo(
    () =>
      state.stockItems.filter((i) => {
        const q = query.trim().toLowerCase();
        return (
          (!q || `${i.name} ${i.category} ${i.location}`.toLowerCase().includes(q)) &&
          (category === "tous" || i.category === category)
        );
      }),
    [state.stockItems, query, category],
  );

  const lowStock = state.stockItems.filter((i) => i.quantity <= i.minQuantity);
  const itemName = (id: string) => state.stockItems.find((i) => i.id === id)?.name ?? "—";
  const userName = (id: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "Système";
  };

  async function submitItem(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs['name'] = "Le nom est obligatoire.";
    if (form.quantity < 0) errs['quantity'] = "Quantité invalide.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (editId) {
      if (!(await update("stockItems", editId, { ...form, updatedAt: todayISO() }))) return;
      log("a modifié un article de stock", "Stock", form.name);
      toast.success("Article modifié");
    } else {
      const item: StockItem = { ...form, id: uid(), updatedAt: todayISO() };
      if (!(await add("stockItems", item))) return;
      log("a ajouté un article de stock", "Stock", item.name);
      toast.success("Article ajouté");
    }
    setOpen(false);
  }

  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(move.quantity);
    if (!move.itemId || !(qty > 0)) {
      toast.error("Sélectionnez un article et une quantité valide.");
      return;
    }
    const negative = ["sortie", "vente", "perte"].includes(move.type);
    if (!(await adjustStock(move.itemId, negative ? -qty : qty, move.type, move.reference))) return;
    log(`a enregistré un mouvement de stock (${move.type})`, "Stock", itemName(move.itemId));
    toast.success("Mouvement enregistré");
    setMoveOpen(false);
    setMove({ ...move, quantity: "", reference: "" });
  }

  return (
    <AppShell module="stock">
      <PageHeader
        title="Stock"
        subtitle={`${state.stockItems.length} article(s) — ${lowStock.length} en alerte`}
        actions={
          editable && (
            <>
              <Button variant="outline" onClick={() => setMoveOpen(true)}>
                <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Mouvement
              </Button>
              <Button
                onClick={() => {
                  setForm(emptyItem);
                  setEditId(null);
                  setErrors({});
                  setOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Article
              </Button>
            </>
          )
        }
      />

      {lowStock.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Stock faible</p>
            <p className="text-sm text-muted-foreground">
              {lowStock.map((i) => `${i.name} (${formatNumber(i.quantity, 0)} ${i.unit})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="articles">
          <div className="card-surface overflow-hidden">
            <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un article…"
                  className="pl-9"
                />
              </div>
              <select
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="tous">Toutes les catégories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Aucun article"
                description="Ajoutez un article au stock."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Minimum</TableHead>
                      <TableHead>Emplacement</TableHead>
                      <TableHead>Mise à jour</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell>{i.category}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(i.quantity, 0)} {i.unit}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(i.minQuantity, 0)}</TableCell>
                        <TableCell>{i.location || "—"}</TableCell>
                        <TableCell>{formatDate(i.updatedAt)}</TableCell>
                        <TableCell>
                          {i.quantity <= i.minQuantity ? (
                            <StatusBadge tone="danger">STOCK FAIBLE</StatusBadge>
                          ) : (
                            <StatusBadge tone="success">OK</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {editable && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const { id: _id, ...rest } = i;
                                    setForm(rest);
                                    setEditId(i.id);
                                    setErrors({});
                                    setOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setToDelete(i)}>
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
        </TabsContent>

        <TabsContent value="mouvements">
          <div className="card-surface overflow-hidden">
            {state.stockMovements.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="Aucun mouvement"
                description="Les entrées et sorties apparaîtront ici."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Article</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Utilisateur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...state.stockMovements]
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{formatDate(m.date)}</TableCell>
                          <TableCell>{itemName(m.itemId)}</TableCell>
                          <TableCell>
                            <StatusBadge
                              tone={
                                m.quantity >= 0
                                  ? m.type === "production"
                                    ? "info"
                                    : "success"
                                  : "danger"
                              }
                            >
                              {m.type}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {m.quantity > 0 ? "+" : ""}
                            {formatNumber(m.quantity, 0)}
                          </TableCell>
                          <TableCell>{m.reference || "—"}</TableCell>
                          <TableCell>{userName(m.userId)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom *" error={errors['name']}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Catégorie">
                <select
                  className={selectClass}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as StockCategory })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantité" error={errors['quantity']}>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </Field>
              <Field label="Unité">
                <select
                  className={selectClass}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as StockUnit })}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stock minimum">
                <Input
                  type="number"
                  value={form.minQuantity}
                  onChange={(e) => setForm({ ...form, minQuantity: Number(e.target.value) })}
                />
              </Field>
              <Field label="Emplacement">
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editId ? "Enregistrer" : "Ajouter"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau mouvement de stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitMove} className="space-y-4">
            <Field label="Article">
              <select
                className={selectClass}
                value={move.itemId}
                onChange={(e) => setMove({ ...move, itemId: e.target.value })}
              >
                <option value="">— Choisir —</option>
                {state.stockItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <select
                  className={selectClass}
                  value={move.type}
                  onChange={(e) => setMove({ ...move, type: e.target.value as MovementType })}
                >
                  {MOVEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantité">
                <Input
                  type="number"
                  min="0"
                  value={move.quantity}
                  onChange={(e) => setMove({ ...move, quantity: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Référence">
              <Input
                value={move.reference}
                onChange={(e) => setMove({ ...move, reference: e.target.value })}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>
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
        label={`l'article « ${toDelete?.name} »`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("stockItems", toDelete.id))) return;
          log("a supprimé un article de stock", "Stock", toDelete.name);
          toast.success("Article supprimé");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

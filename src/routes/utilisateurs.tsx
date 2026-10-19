import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { PermissionsDialog } from "@/components/common/PermissionsDialog";
import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PASSWORD_RULE, isStrongPassword } from "@/lib/users.functions";
import { useApp } from "@/context/AppContext";
import { formatDate, todayISO, uid } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role, User } from "@/lib/types";

export const Route = createFileRoute("/utilisateurs")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Utilisateurs — Medjadja Olive" },
      {
        name: "description",
        content: "Comptes utilisateurs, rôles et activation des accès à l'application.",
      },
      { property: "og:title", content: "Utilisateurs — Medjadja Olive" },
      { property: "og:description", content: "Gestion des comptes et des rôles." },
    ],
  }),
  component: UsersPage,
});

const emptyUser = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: "CONSULTATION" as Role,
  active: true,
};

function UsersPage() {
  const { state, add, update, remove, canEdit, currentUser } = useApp();
  const editable = canEdit("users");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyUser);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [permUser, setPermUser] = useState<User | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs['firstName'] = "Le prénom est obligatoire.";
    if (!form.lastName.trim()) errs['lastName'] = "Le nom est obligatoire.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs['email'] = "Email invalide.";
    if ((!editId || form.password) && !isStrongPassword(form.password)) errs['password'] = PASSWORD_RULE;
    const dup = state.users.find(
      (u) => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.id !== editId,
    );
    if (dup) errs['email'] = "Cet email est déjà utilisé.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (editId) {
      if (!(await update("users", editId, { ...form, email: form.email.trim().toLowerCase() }))) return;
      toast.success("Utilisateur modifié");
    } else {
      const user: User = {
        ...form,
        email: form.email.trim().toLowerCase(),
        id: uid(),
        createdAt: todayISO(),
      };
      if (!(await add("users", user))) return;
      toast.success("Utilisateur créé");
    }
    setOpen(false);
  }

  async function toggleActive(u: User) {
    if (!(await update("users", u.id, { active: !u.active }))) return;
    toast.success(u.active ? "Compte désactivé" : "Compte activé");
  }

  return (
    <AppShell module="users">
      <PageHeader
        title="Utilisateurs"
        subtitle={`${state.users.length} compte(s)`}
        actions={
          editable && (
            <Button
              onClick={() => {
                setForm(emptyUser);
                setEditId(null);
                setErrors({});
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nouvel utilisateur
            </Button>
          )
        }
      />

      <div className="card-surface overflow-hidden">
        {state.users.length === 0 ? (
          <EmptyState icon={UserCog} title="Aucun utilisateur" description="Créez un compte." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.firstName} {u.lastName}
                      {u.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                    <TableCell>{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {editable && u.id !== currentUser?.id ? (
                          <Switch aria-label={`Actif ${u.email}`} checked={u.active} onCheckedChange={() => toggleActive(u)} />
                        ) : null}
                        <StatusBadge tone={u.active ? "success" : "danger"}>
                          {u.active ? "Actif" : "Désactivé"}
                        </StatusBadge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {editable && (
                          <>
                            <Button variant="ghost" size="icon" aria-label={`Droits ${u.email}`} title="Droits d'accès" onClick={() => setPermUser(u)}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Modifier ${u.email}`}
                              onClick={() => {
                                setForm({
                                  firstName: u.firstName,
                                  lastName: u.lastName,
                                  email: u.email,
                                  phone: u.phone,
                                  password: "",
                                  role: u.role,
                                  active: u.active,
                                });
                                setEditId(u.id);
                                setErrors({});
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {u.id !== currentUser?.id && (
                              <Button variant="ghost" size="icon" aria-label={`Supprimer ${u.email}`} onClick={() => setToDelete(u)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom *" error={errors['firstName']}>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </Field>
              <Field label="Nom *" error={errors['lastName']}>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </Field>
              <Field label="Email *" error={errors['email']}>
                <Input
                  type="text"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Téléphone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field
                label={editId ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe temporaire *"}
                error={errors['password']}
                hint={PASSWORD_RULE}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              <Field label="Rôle">
                <select
                  className={selectClass}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                >
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Compte actif">
                <div className="flex h-9 items-center">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                </div>
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editId ? "Enregistrer" : "Créer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PermissionsDialog user={permUser} onClose={() => setPermUser(null)} />

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        label={`le compte de ${toDelete?.firstName} ${toDelete?.lastName}`}
        onConfirm={async () => {
          if (!toDelete) return;
          if (!(await remove("users", toDelete.id))) return;
          toast.success("Utilisateur supprimé");
          setToDelete(null);
        }}
      />
    </AppShell>
  );
}

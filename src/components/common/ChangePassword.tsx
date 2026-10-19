import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/Field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { PASSWORD_RULE, isStrongPassword } from "@/lib/users.functions";

export function PasswordForm({ onDone }: { onDone: () => void }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStrongPassword(pwd)) return setError(PASSWORD_RULE);
    if (pwd !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      await api.updatePassword(pwd);
    } catch {
      setBusy(false);
      return setError("Changement impossible. Choisissez un mot de passe moins courant.");
    }
    setBusy(false);
    toast.success("Mot de passe modifié");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nouveau mot de passe" hint={PASSWORD_RULE}>
        <Input type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
      </Field>
      <Field label="Confirmer le mot de passe" error={error || undefined}>
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
      </DialogFooter>
    </form>
  );
}

export function ChangePasswordButton({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <KeyRound className="h-4 w-4" />
        Mot de passe
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer mon mot de passe</DialogTitle>
          </DialogHeader>
          {open && <PasswordForm onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { logoUrl } from "@/lib/brand";
import { api } from "@/lib/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/Field";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Connexion — Medjadja Olive" },
      {
        name: "description",
        content: "Connectez-vous à la gestion de votre unité de fabrication d'huile d'olive.",
      },
      { property: "og:title", content: "Connexion — Medjadja Olive" },
      {
        property: "og:description",
        content: "Accès à la gestion de l'unité : réception, production, stock, ventes.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, currentUser, ready, state } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    if (ready && currentUser)
      navigate({ to: currentUser.role === "CHAUFFEUR" ? "/chauffeur" : currentUser.role === "VENDEUR" ? "/showroom" : "/tableau-de-bord" });
  }, [ready, currentUser, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Connexion impossible.");
      return;
    }
    toast.success("Connexion réussie");
  }

  async function sendReset() {
    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) {
      setError("Saisissez un email valide pour recevoir le lien.");
      return;
    }
    await api.resetPassword(resetEmail.trim().toLowerCase()).catch(() => undefined);
    toast.success("Si ce compte existe, un email de réinitialisation a été envoyé.");
    setShowReset(false);
    setResetEmail("");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Logo Medjadja Olive" className="h-20 w-20 shrink-0 object-contain" />
          <div>
            <p className="font-display text-base font-semibold">{state.settings.companyName}</p>
            <p className="text-xs text-sidebar-foreground/70">Gestion de l'huilerie</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight">
            De la réception des olives à la vente de l'huile.
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/80">
            Suivez les livraisons des agriculteurs, le rendement de chaque trituration, le stock, les
            ventes et les dépenses — dans une seule application simple.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            {[
              { k: "Rendement auto", v: "Production" },
              { k: "Alertes", v: "Stock" },
              { k: "Paiements", v: "Ventes" },
            ].map((s) => (
              <div key={s.k} className="rounded-xl bg-sidebar-accent/60 px-3 py-4">
                <p className="font-display text-lg font-semibold">{s.v}</p>
                <p className="mt-1 text-xs text-sidebar-foreground/70">{s.k}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-foreground/60">© {new Date().getFullYear()} {state.settings.companyName}</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logoUrl} alt="Logo Medjadja Olive" className="h-16 w-16 shrink-0 object-contain" />
            <p className="font-display font-semibold">{state.settings.companyName}</p>
          </div>
          <h1 className="font-display text-2xl font-semibold">Connexion</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrez vos identifiants pour accéder à votre tableau de bord.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nom@huilerie.dz"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Mot de passe" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {showReset ? (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                <Field label="Email du compte" htmlFor="reset-email">
                  <Input
                    id="reset-email"
                    type="text"
                    autoComplete="email"
                    placeholder="nom@huilerie.dz"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={sendReset}>
                    Recevoir le lien
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowReset(false);
                      setResetEmail("");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShowReset(true)}
              >
                Mot de passe oublié ?
              </button>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}

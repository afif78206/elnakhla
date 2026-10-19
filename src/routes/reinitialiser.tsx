import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PasswordForm } from "@/components/common/ChangePassword";

export const Route = createFileRoute("/reinitialiser")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Medjadja Olive" },
      { name: "description", content: "Définir un nouveau mot de passe pour votre compte." },
      { property: "og:title", content: "Nouveau mot de passe — Medjadja Olive" },
      { property: "og:description", content: "Réinitialisation du mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="card-surface w-full max-w-md p-6">
        <h1 className="mb-1 font-display text-xl font-semibold">Nouveau mot de passe</h1>
        <p className="mb-5 text-sm text-muted-foreground">Choisissez votre nouveau mot de passe.</p>
        <PasswordForm onDone={() => navigate({ to: "/tableau-de-bord" })} />
      </div>
    </div>
  );
}

import { logoUrl } from "@/lib/brand";
import { ChangePasswordButton } from "@/components/common/ChangePassword";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  BarChart3,
  Boxes,
  ClipboardList,
  Factory,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings as SettingsIcon,
  ShoppingCart,
  Store,
  Sprout,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { ROLE_LABELS } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV: { key: ModuleKey; label: string; to: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Tableau de bord", to: "/tableau-de-bord", icon: LayoutDashboard },
  { key: "receptions", label: "Réception olives", to: "/receptions", icon: ClipboardList },
  { key: "production", label: "Production", to: "/production", icon: Factory },
  { key: "stock", label: "Stock", to: "/stock", icon: Boxes },
  { key: "suppliers", label: "Fournisseurs", to: "/fournisseurs", icon: Sprout },
  { key: "customers", label: "Clients", to: "/clients", icon: Users },
  { key: "sales", label: "Ventes", to: "/ventes", icon: ShoppingCart },
  { key: "sales", label: "Showroom (caisse)", to: "/showroom", icon: Store },
  { key: "expenses", label: "Dépenses", to: "/depenses", icon: Wallet },
  { key: "caisse", label: "Caisse", to: "/caisse", icon: Banknote },
  { key: "flotte", label: "Chauffeurs", to: "/flotte", icon: Truck },
  { key: "reports", label: "Rapports", to: "/rapports", icon: BarChart3 },
  { key: "users", label: "Utilisateurs", to: "/utilisateurs", icon: Receipt },
  { key: "history", label: "Historique", to: "/historique", icon: History },
  { key: "settings", label: "Paramètres", to: "/parametres", icon: SettingsIcon },
];

export function AppShell({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { currentUser, ready, logout, can, state } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Veuillez vous connecter pour continuer.</p>
        <Button onClick={() => navigate({ to: "/" })}>Aller à la connexion</Button>
      </div>
    );
  }

  if (currentUser.role === "CHAUFFEUR") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Votre espace est l'application chauffeur.</p>
        <Button onClick={() => navigate({ to: "/chauffeur" })}>Ouvrir l'espace chauffeur</Button>
      </div>
    );
  }

  if (currentUser.role === "VENDEUR") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Votre espace est la caisse du showroom.</p>
        <Button onClick={() => navigate({ to: "/showroom" })}>Ouvrir le showroom</Button>
      </div>
    );
  }

  if (!can(module)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-semibold">Accès non autorisé</h1>
        <p className="text-sm text-muted-foreground">
          Votre rôle ({ROLE_LABELS[currentUser.role]}) n'a pas accès à ce module.
        </p>
        <Button onClick={() => navigate({ to: "/tableau-de-bord" })}>Tableau de bord</Button>
      </div>
    );
  }

  const items = NAV.filter((item) => can(item.key));

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src={logoUrl} alt="Logo Medjadja Olive" className="h-12 w-12 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{state.settings.companyName}</p>
          <p className="text-xs text-sidebar-foreground/70">Gestion de l'huilerie</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
            {currentUser.firstName[0]}
            {currentUser.lastName[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              {ROLE_LABELS[currentUser.role]}
            </p>
          </div>
        </div>
        <ChangePasswordButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground" />
        <button
          onClick={() => {
            logout();
            navigate({ to: "/" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 text-sidebar-foreground"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </button>
          <img src={logoUrl} alt="Logo Medjadja Olive" className="h-9 w-9 shrink-0 object-contain" />
          <span className="min-w-0 truncate font-display text-sm font-semibold">{state.settings.companyName}</span>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

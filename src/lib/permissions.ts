import type { ModuleKey, Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  RESPONSABLE_PRODUCTION: "Responsable production",
  MAGASINIER: "Magasinier",
  COMMERCIAL: "Commercial",
  COMPTABLE: "Comptable",
  CONSULTATION: "Consultation",
  CHAUFFEUR: "Chauffeur",
  VENDEUR: "Vendeur showroom",
};

const ALL: ModuleKey[] = [
  "dashboard",
  "receptions",
  "production",
  "stock",
  "suppliers",
  "customers",
  "sales",
  "expenses",
  "caisse",
  "reports",
  "users",
  "history",
  "settings",
  "flotte",
];

export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  ADMIN: ALL,
  RESPONSABLE_PRODUCTION: ["dashboard", "receptions", "production", "suppliers", "stock", "reports"],
  MAGASINIER: ["dashboard", "stock", "production", "reports", "flotte"],
  COMMERCIAL: ["dashboard", "customers", "sales", "stock", "reports", "flotte"],
  COMPTABLE: ["dashboard", "expenses", "caisse", "sales", "reports", "flotte"],
  CONSULTATION: ALL.filter((m) => m !== "users" && m !== "settings"),
  CHAUFFEUR: [],
  VENDEUR: [],
};

/** Read-only roles cannot create, modify or delete anything. */
export function canWrite(role: Role, module: ModuleKey): boolean {
  if (role === "CONSULTATION") return false;
  if (!ROLE_MODULES[role].includes(module)) return false;
  if (role === "ADMIN") return true;
  const readOnlyFor: Partial<Record<Role, ModuleKey[]>> = {
    RESPONSABLE_PRODUCTION: ["stock", "reports", "dashboard"],
    MAGASINIER: ["reports", "dashboard", "production"],
    COMMERCIAL: ["stock", "reports", "dashboard"],
    COMPTABLE: ["sales", "reports", "dashboard"],
  };
  return !(readOnlyFor[role] ?? []).includes(module);
}

export function canView(role: Role, module: ModuleKey): boolean {
  return ROLE_MODULES[role].includes(module);
}

export type AccessLevel = "none" | "read" | "write";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Tableau de bord",
  receptions: "Réception olives",
  production: "Production",
  stock: "Stock",
  suppliers: "Fournisseurs",
  customers: "Clients",
  sales: "Ventes et paiements",
  expenses: "Dépenses",
  caisse: "Caisse",
  reports: "Rapports",
  users: "Utilisateurs",
  history: "Historique",
  settings: "Paramètres",
  flotte: "Chauffeurs et livraisons",
};

export const ALL_MODULES = ALL;

/** Niveau par défaut donné par le rôle (modèle de départ). */
export function roleLevel(role: Role, module: ModuleKey): AccessLevel {
  if (canWrite(role, module)) return "write";
  return canView(role, module) ? "read" : "none";
}

/** Niveau effectif : l'admin a tout ; sinon réglage personnalisé, sinon rôle. */
export function effectiveLevel(
  role: Role,
  module: ModuleKey,
  overrides?: Partial<Record<ModuleKey, AccessLevel>>,
): AccessLevel {
  if (role === "ADMIN") return "write";
  if (module === "users" || module === "settings") {
    const o = overrides?.[module];
    return o === "write" ? "read" : (o ?? roleLevel(role, module));
  }
  return overrides?.[module] ?? roleLevel(role, module);
}

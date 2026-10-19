import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { effectiveLevel } from "@/lib/permissions";
import { createAppUser, deleteAppUser, updateAppUser } from "@/lib/users.functions";
import type { ActivityLog, AppState, ModuleKey, MovementType, Role, Settings, User } from "@/lib/types";

type Collections = Exclude<keyof AppState, "settings">;
type Item<K extends Collections> = AppState[K][number];

const TABLES: Record<Exclude<Collections, "users">, string> = {
  suppliers: "suppliers",
  customers: "customers",
  receptions: "olive_receptions",
  productions: "productions",
  stockItems: "stock_items",
  stockMovements: "stock_movements",
  sales: "sales",
  expenses: "expenses",
  cashMovements: "cash_movements",
  logs: "activity_logs",
};

const DEFAULT_SETTINGS: Settings = {
  companyName: "Medjadja Olive",
  phone: "",
  address: "",
  wilaya: "",
  taxNumber: "",
  currency: "DZD",
  defaultUnit: "L",
  lowStockThreshold: 20,
  numberFormat: "PREFIX-ANNEE-0000",
  autoPrintReceipt: false,
  dailyPrice: 0,
};

const EMPTY: AppState = {
  users: [],
  suppliers: [],
  customers: [],
  receptions: [],
  productions: [],
  stockItems: [],
  stockMovements: [],
  sales: [],
  expenses: [],
  cashMovements: [],
  logs: [],
  settings: DEFAULT_SETTINGS,
};


const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v === null ? "" : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && k !== "phone" && k !== "number" && k !== "time" && k !== "tax_number" ? Number(v) : v;
  }
  return out as T;
}
function toRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "createdAt" || k === "updatedAt" || k === "yieldPct" || k === "remaining") continue;
    // empty uuid refs -> null
    out[toSnake(k)] = v === "" && /Id$/.test(k) ? null : v;
  }
  return out;
}

const FRIENDLY: [RegExp, string][] = [
  [/row-level security|permission denied/i, "Vous n'avez pas les droits pour effectuer cette action."],
  [/duplicate key|_number_key/i, "Cette opération a déjà été enregistrée (numéro en double)."],
  [/weight_kg_check/, "Le poids doit être supérieur à 0."],
  [/price_per_kg|rec_price/, "Le prix au kg ne peut pas être négatif."],
  [/olives_kg_check/, "La quantité d'olives doit être supérieure à 0."],
  [/oil_liters_check/, "La quantité d'huile ne peut pas être négative."],
  [/byproducts/, "Les sous-produits ne peuvent pas être négatifs."],
  [/sales_quantity_check/, "La quantité doit être supérieure à 0."],
  [/unit_price_check/, "Le prix unitaire ne peut pas être négatif."],
  [/paid_check|Montant payé invalide/, "Le montant payé doit être compris entre 0 et le total."],
  [/Mixte invalide/, "Mixte invalide : partie vendue + partie huile doit être égale au poids total."],
  [/amount_check/, "Le montant doit être supérieur à 0."],
  [/quantity_check|stock_min_check/, "La quantité ne peut pas être négative."],
  [/foreign key|23503/i, "Suppression impossible : cet élément est utilisé ailleurs."],
  [/Failed to fetch|NetworkError/i, "Connexion au serveur impossible. Vérifiez votre réseau."],
];
function errMsg(e: unknown): string {
  const raw = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  for (const [re, msg] of FRIENDLY) if (re.test(raw)) return msg;
  if (/Stock insuffisant|introuvable|Huile en vrac|Vous ne pouvez|Séparation des tâches|en cours de modification|Impossible :|réservée|Mot de passe|already|registered/i.test(raw))
    return /already|registered/i.test(raw) ? "Cet email est déjà utilisé." : raw;
  return "Opération impossible. Veuillez réessayer.";
}

interface AppContextValue {
  state: AppState;
  ready: boolean;
  currentUser: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  can: (module: ModuleKey) => boolean;
  canEdit: (module: ModuleKey) => boolean;
  add: <K extends Collections>(key: K, item: Item<K>) => Promise<boolean>;
  update: <K extends Collections>(key: K, id: string, patch: Partial<Item<K>>) => Promise<boolean>;
  remove: <K extends Collections>(key: K, id: string) => Promise<boolean>;
  saveSettings: (patch: Partial<Settings>) => Promise<boolean>;
  log: (action: string, module: string, reference: string) => void;
  adjustStock: (itemId: string, delta: number, type: MovementType, reference: string) => Promise<boolean>;
  resetDemo: () => void;
}

// Contexte conservé entre rechargements à chaud, sinon le Provider et useApp divergent.
const g = globalThis as { __appContext?: React.Context<AppContextValue | null> };
const AppContext = (g.__appContext ??= createContext<AppContextValue | null>(null));

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const loadAll = useCallback(async () => {
    const keys = Object.keys(TABLES) as (keyof typeof TABLES)[];
    const results = await Promise.all(keys.map((k) => api.list(TABLES[k]).catch(() => [] as Record<string, unknown>[])));
    const [profiles, roles, perms, settingsRows] = await Promise.all([
      api.list("profiles").catch(() => [] as Record<string, unknown>[]),
      api.list("user_roles").catch(() => [] as Record<string, unknown>[]),
      api.list("user_permissions").catch(() => [] as Record<string, unknown>[]),
      api.list("settings").catch(() => [] as Record<string, unknown>[]),
    ]);
    const next: AppState = { ...EMPTY };
    keys.forEach((k, i) => {
      (next as unknown as Record<string, unknown>)[k] = (results[i] ?? []).map((r) => fromRow(r));
    });
    const roleOf = new Map(
      (roles as { user_id: string; role: Role }[]).map((r) => [r.user_id, r.role]),
    );
    next.users = (profiles as Record<string, unknown>[]).map((p) => {
      const u = fromRow<Record<string, unknown>>(p);
      return {
        id: String(u["id"]),
        firstName: String(u["firstName"] ?? ""),
        lastName: String(u["lastName"] ?? ""),
        email: String(u["email"] ?? ""),
        phone: String(u["phone"] ?? ""),
        active: Boolean(u["active"]),
        role: roleOf.get(String(u["id"])) ?? "CONSULTATION",
        password: "",
        createdAt: String(u["createdAt"] ?? ""),
        permissions: Object.fromEntries(
          (perms as { user_id: string; module: string; level: string }[])
            .filter((x) => x.user_id === String(u["id"]))
            .map((x) => [x.module, x.level]),
        ) as NonNullable<User["permissions"]>,
      };
    });
    const s = (settingsRows as Record<string, unknown>[]).find((r) => Number(r["id"]) === 1) ?? settingsRows[0];
    if (s) {
      next.settings = { ...DEFAULT_SETTINGS, ...fromRow<Settings>(s) };
    }
    setState(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (uid) {
        userIdRef.current = uid;
        setUserId(uid);
        await loadAll();
      }
      if (mounted) setReady(true);
    };
    void boot();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        setUserId(null);
        setState(EMPTY);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAll]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === userId && u.active) ?? null,
    [state.users, userId],
  );

  const log = useCallback((action: string, module: string, reference: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    void api
      .insert<Record<string, unknown>>("activity_logs", { user_id: uid, action, module, reference })
      .then((data) => {
        if (data) setState((p) => ({ ...p, logs: [fromRow<ActivityLog>(data), ...p.logs].slice(0, 300) }));
      })
      .catch(() => undefined);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const r = await api.login(email.trim().toLowerCase(), password);
        if (r.user?.active === false) {
          await api.logout();
          return { ok: false, error: "Ce compte est désactivé. Contactez l'administrateur." };
        }
        userIdRef.current = r.user.id;
        setUserId(r.user.id);
        await loadAll();
        log("s'est connecté", "Authentification", "—");
        return { ok: true };
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 400)) {
          return { ok: false, error: "Email ou mot de passe incorrect." };
        }
        return { ok: false, error: "Connexion impossible. Vérifiez votre connexion et réessayez." };
      }
    },
    [loadAll, log],
  );

  const logout = useCallback(() => {
    userIdRef.current = null;
    setUserId(null);
    setState(EMPTY);
    void supabase.auth.signOut().catch(() => undefined);
  }, []);

  const inflight = useRef(0);
  const guard = useCallback(async (fn: () => Promise<boolean>) => {
    if (inflight.current > 0) return false; // double-clic : on ignore
    inflight.current++;
    document.body.dataset["saving"] = "1";
    try {
      return await fn();
    } finally {
      inflight.current--;
      delete document.body.dataset["saving"];
    }
  }, []);

  const fail = (e: unknown) => {
    toast.error(errMsg(e));
    return false;
  };

  const add = useCallback(
    async <K extends Collections>(key: K, item: Item<K>) => {
      try {
        if (key === "users") {
          await createAppUser({ data: item as unknown as User });
        } else {
          const row = await api.insert<Record<string, unknown>>(
            TABLES[key as keyof typeof TABLES],
            toRow(item as unknown as Record<string, unknown>),
          );
          // numéro attribué par le serveur (atomique)
          if (row && typeof row["number"] === "string")
            (item as unknown as Record<string, unknown>)["number"] = row["number"];
          if (row && typeof row["reference"] === "string" && "reference" in (item as object))
            (item as unknown as Record<string, unknown>)["reference"] = row["reference"];
        }
        await loadAll();
        return true;
      } catch (e) {
        await loadAll();
        return fail(e);
      }
    },
    [loadAll],
  );

  const update = useCallback(
    async <K extends Collections>(key: K, id: string, patch: Partial<Item<K>>) => {
      try {
        if (key === "users") {
          await updateAppUser({ data: { ...(patch as Partial<User>), id } });
        } else {
          await api.update(TABLES[key as keyof typeof TABLES], id, toRow(patch as Record<string, unknown>));
        }
        await loadAll();
        return true;
      } catch (e) {
        await loadAll();
        return fail(e);
      }
    },
    [loadAll],
  );

  const remove = useCallback(
    async <K extends Collections>(key: K, id: string) => {
      try {
        if (key === "users") {
          await deleteAppUser({ data: { id } });
        } else {
          await api.remove(TABLES[key as keyof typeof TABLES], id);
        }
        await loadAll();
        return true;
      } catch (e) {
        await loadAll();
        return fail(e);
      }
    },
    [loadAll],
  );

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      try {
        await api.update("settings", 1, toRow(patch as Record<string, unknown>));
        await loadAll();
        return true;
      } catch (e) {
        await loadAll();
        return fail(e);
      }
    },
    [loadAll],
  );

  const adjustStock = useCallback(
    async (itemId: string, delta: number, type: MovementType, reference: string) => {
      try {
        await api.insert("stock_movements", {
          item_id: itemId,
          quantity: delta,
          type,
          reference,
          user_id: userIdRef.current,
        });
        await loadAll();
        return true;
      } catch (e) {
        await loadAll();
        return fail(e);
      }
    },
    [loadAll],
  );

  const resetDemo = useCallback(() => {
    void loadAll();
  }, [loadAll]);

  const value: AppContextValue = {
    state,
    ready,
    currentUser,
    login,
    logout,
    can: (module) =>
      currentUser ? effectiveLevel(currentUser.role, module, currentUser.permissions) !== "none" : false,
    canEdit: (module) =>
      currentUser ? effectiveLevel(currentUser.role, module, currentUser.permissions) === "write" : false,
    add: ((k: Collections, i: never) => guard(() => add(k, i))) as AppContextValue["add"],
    update: ((k: Collections, id: string, p: never) => guard(() => update(k, id, p))) as AppContextValue["update"],
    remove: ((k: Collections, id: string) => guard(() => remove(k, id))) as AppContextValue["remove"],
    saveSettings: (p) => guard(() => saveSettings(p)),
    log,
    adjustStock: (i, d, t, r) => guard(() => adjustStock(i, d, t, r)),
    resetDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

// Gestion des comptes utilisateurs — fonctions serveur (réservées ADMIN).
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = [
  "ADMIN",
  "RESPONSABLE_PRODUCTION",
  "MAGASINIER",
  "COMMERCIAL",
  "COMPTABLE",
  "CONSULTATION",
  "CHAUFFEUR",
  "VENDEUR",
] as const;

export const PASSWORD_RULE =
  "8 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial.";
export function isStrongPassword(p: string) {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
}

const userSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().max(50),
  role: z.enum(ROLES),
  active: z.boolean(),
  password: z.string().max(100),
});

type AuthedContext = { supabase: unknown; userId: string };

async function checkAdmin(context: AuthedContext) {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "ADMIN" });
  if (error || data !== true) {
    throw new Error("Seul l'administrateur peut gérer les utilisateurs.");
  }
}

/** Création d'un utilisateur (réservé admin, vérifié côté serveur). */
export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => userSchema.parse(d))
  .handler(async ({ context, data }) => {
    if (!isStrongPassword(data.password)) throw new Error("Mot de passe : " + PASSWORD_RULE);
    await checkAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Création du compte impossible.");
    const id = created.user.id;
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id,
      first_name: data.firstName,
      last_name: data.lastName,
      email,
      phone: data.phone,
      active: data.active,
    });
    if (profErr) throw new Error(profErr.message);
    const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: data.role });
    if (roleErr) throw new Error(roleErr.message);
    return { id };
  });

/** Modification d'un utilisateur (réservé admin, vérifié côté serveur). */
export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => userSchema.partial().extend({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    await checkAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;

    // Protection du dernier administrateur
    if (
      (patch.role && patch.role !== "ADMIN") ||
      patch.active === false
    ) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", id);
      if (roles?.some((r) => r.role === "ADMIN")) {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "ADMIN");
        if ((count ?? 0) <= 1) throw new Error("Impossible : c'est le dernier administrateur.");
      }
    }

    const attrs: Record<string, unknown> = {};
    if (patch["email"]) attrs["email"] = patch["email"].toLowerCase();
    if (patch["password"]) attrs["password"] = patch["password"];
    if (Object.keys(attrs).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, attrs as never);
      if (error) throw new Error(error.message);
    }

    const prof: Record<string, unknown> = {};
    if (patch["firstName"]) prof["first_name"] = patch["firstName"];
    if (patch["lastName"]) prof["last_name"] = patch["lastName"];
    if (patch["phone"] !== undefined) prof["phone"] = patch["phone"];
    if (patch["active"] !== undefined) prof["active"] = patch["active"];
    if (patch["email"]) prof["email"] = patch["email"].toLowerCase();
    if (Object.keys(prof).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(prof as never).eq("id" as never, id);
      if (error) throw new Error(error.message);
    }

    if (patch.role) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: patch.role });
      if (error) throw new Error(error.message);
    }
    return { id };
  });

/** Suppression d'un utilisateur (réservé admin, vérifié côté serveur). */
export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    await checkAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id);
    if (roles?.some((r) => r.role === "ADMIN")) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "ADMIN");
      if ((count ?? 0) <= 1) throw new Error("Impossible : c'est le dernier administrateur.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

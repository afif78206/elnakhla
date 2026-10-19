/**
 * Couche d'accès aux données de l'application, branchée sur Lovable Cloud.
 * Les requêtes passent par le client Supabase généré (RLS appliquée pour
 * l'utilisateur connecté). La gestion des comptes (création/modification/
 * suppression) passe par des fonctions serveur : voir src/lib/users.functions.ts
 */

import { supabase } from "@/integrations/supabase/client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface LoginResult {
  token: string;
  user: { id: string; active?: boolean };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type LooseClient = {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const db = supabase as unknown as LooseClient;

export const api = {
  async uploadProductPhoto(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) throw new ApiError("Choisissez une image.", 400);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("product-photos").upload(path, file, { contentType: file.type });
    if (error) throw new ApiError(error.message, 400);
    return `storage:${path}`;
  },
  async productPhotoUrl(source: string): Promise<string> {
    if (!source.startsWith("storage:")) return source;
    const { data, error } = await supabase.storage.from("product-photos").createSignedUrl(source.slice(8), 3600);
    if (error) throw new ApiError(error.message, 400);
    return data.signedUrl;
  },
  // ---- Authentification (email + mot de passe) ----
  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new ApiError(error?.message ?? "Identifiants invalides", 401);
    }
    const { data: prof, error: profErr } = await db
      .from("profiles")
      .select("active")
      .eq("id", data.user.id)
      .single();
    if (profErr) throw new ApiError(profErr.message, 400);
    return { token: data.session.access_token, user: { id: data.user.id, active: prof?.active ?? true } };
  },
  async logout() {
    await supabase.auth.signOut();
  },
  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new ApiError(error.message, 400);
  },
  updatePassword: async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new ApiError(error.message, 400);
  },

  // ---- Tables (CRUD générique) ----
  async list<T = Record<string, unknown>>(table: string): Promise<T[]> {
    const { data, error } = await db.from(table).select("*");
    if (error) throw new ApiError(error.message, 400);
    return (data ?? []) as T[];
  },
  async insert<T = Record<string, unknown>>(table: string, row: Record<string, unknown>): Promise<T> {
    const { data, error } = await db.from(table).insert(row).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data as T;
  },
  async update<T = Record<string, unknown>>(
    table: string,
    id: string | number,
    patch: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await db.from(table).update(patch).eq("id", id).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data as T;
  },
  async remove(table: string, id: string | number): Promise<void> {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) throw new ApiError(error.message, 400);
  },

  // ---- Opérations métier (verrous, flotte, showroom, permissions…) ----
  async rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new ApiError(error.message, 400);
    return data as T;
  },
};

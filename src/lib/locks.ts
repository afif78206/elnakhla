import { toast } from "sonner";
import { api } from "@/lib/api";

/** Verrouille une fiche critique pour l'édition. Renvoie false si quelqu'un d'autre la modifie. */
export async function acquireLock(table: string, id: string): Promise<boolean> {
  try {
    const data = await api.rpc<string | null>("acquire_lock", { _table: table, _id: id });
    if (data) {
      toast.error(`Fiche en cours de modification par ${data}. Réessayez plus tard.`);
      return false;
    }
    return true;
  } catch {
    toast.error("Impossible de verrouiller la fiche.");
    return false;
  }
}

export async function releaseLock(table: string, id: string) {
  try {
    await api.rpc("release_lock", { _table: table, _id: id });
  } catch {
    /* libération silencieuse */
  }
}

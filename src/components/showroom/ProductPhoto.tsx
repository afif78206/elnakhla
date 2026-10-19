import { useEffect, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { productPhotos } from "@/lib/product-photos";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ProductPhoto({ source, name, className = "" }: { source?: string | undefined; name: string; className?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    const resolve = () => { if (source) void api.productPhotoUrl(source).then((value) => { if (active) setUrl(value); }).catch(() => { if (active) setUrl(""); }); };
    setUrl(""); resolve();
    const interval = setInterval(resolve, 3000000);
    return () => { active = false; clearInterval(interval); };
  }, [source]);
  return url ? <img src={url} alt={name} className={`object-contain ${className}`} onError={() => setUrl("")} /> : <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}><ImageIcon className="h-8 w-8" /></div>;
}

export function ProductPhotoPicker({ value, onChange, busy, onBusy }: { value: string; onChange: (source: string) => void; busy: boolean; onBusy: (busy: boolean) => void }) {
  async function upload(file?: File) {
    if (!file) return;
    onBusy(true);
    try { onChange(await api.uploadProductPhoto(file)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Photo non enregistrée"); }
    finally { onBusy(false); }
  }
  return <div className="space-y-2">
    <p className="text-sm font-medium">Photo du produit</p>
    <div className="flex items-center gap-3">
      <ProductPhoto source={value} name="Photo sélectionnée" className="h-24 w-20 rounded-md border border-border" />
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer text-sm text-primary"><span className="flex items-center gap-2"><Upload className="h-4 w-4" />{busy ? "Chargement…" : "Importer une photo"}</span><input aria-label="Importer une photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); }} /></label>
        {value && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange("")}><X className="h-4 w-4" /> Retirer</Button>}
      </div>
    </div>
    <div className="grid grid-cols-5 gap-2">{productPhotos.map((photo) => <Button key={photo.url} type="button" variant="outline" aria-label={`Choisir ${photo.label}`} aria-pressed={value === photo.url} disabled={busy} className={`h-20 p-1 ${value === photo.url ? "border-primary ring-2 ring-ring" : ""}`} onClick={() => onChange(photo.url)}><img src={photo.url} alt={photo.label} className="h-full w-full object-contain" /></Button>)}</div>
  </div>;
}
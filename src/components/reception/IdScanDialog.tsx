import { Camera, Loader2, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/common/Field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Phase = "camera" | "busy" | "result" | "error";

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])[a-zà-ÿ]/g, (c) => c.toUpperCase());
}

// Mots fréquents sur une carte d'identité qui ne sont jamais un nom de famille.
const NOISE_WORD =
  /^(r[ée]publique|alg[ée]rienne?|d[ée]mocratique|populaire|carte|nationale?|identit[ée]|minist[èe]re|int[ée]rieur|date|naissance|n[ée]e?s?|le|la|et|de|du|des|lieu|sexe|masculin|f[ée]minin|groupe|sanguin|adresse|commune|wilaya|da[ïi]ra|expire|expiration|d[ée]livr[ée]e?s?|signature|autorit[ée]|num[ée]ro|taille|yeux|profession|p[èe]re|m[èe]re)$/i;

function isNoise(line: string): boolean {
  const words = line.split(" ").filter((w) => w.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 2);
  return words.length > 0 && words.every((w) => NOISE_WORD.test(w));
}

const RE_NOM = /^noms?\b/i;
const RE_PRENOM = /^pr[ée]noms?\b/i;

function isUpperName(line: string): boolean {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 2 && letters === letters.toUpperCase();
}

function looksLikeName(line: string): boolean {
  return !isNoise(line) && !RE_NOM.test(line) && !RE_PRENOM.test(line) && line.split(" ").length <= 4;
}

/**
 * Heuristique : étiquette « Nom / Prénom(s) » avec la valeur sur la même ligne ou sur la
 * ligne suivante (cas des cartes algériennes), sinon repli sur les lignes en majuscules.
 */
export function parseIdText(text: string): { nom: string; prenom: string } {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/[^A-Za-zÀ-ÿ' -]/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => l.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 2);

  let nom = "";
  let prenom = "";

  // Valeur après l'étiquette : reste de la ligne, sinon première ligne suivante plausible.
  const valueAt = (i: number): string => {
    const rest = (lines[i] ?? "")
      .replace(/^(?:noms?|pr[ée]noms?)\b/i, "")
      .replace(/^\s*(?:\(s\))?\s*[:\-–.]?\s*/i, "")
      .trim();
    if (rest.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 2 && !isNoise(rest)) return rest;
    return lines.slice(i + 1).find(looksLikeName) ?? "";
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (!nom && RE_NOM.test(l) && !RE_PRENOM.test(l)) nom = valueAt(i);
    if (!prenom && RE_PRENOM.test(l)) prenom = valueAt(i);
  }

  // Repli : première ligne entièrement en majuscules qui n'est pas du texte de carte,
  // puis la ligne suivante comme prénom (majuscules ou nom propre).
  if (!nom) {
    nom = lines.find((l) => isUpperName(l) && looksLikeName(l)) ?? "";
  }
  if (!prenom && nom) {
    const i = lines.findIndex((l) => l.includes(nom));
    const cand = lines
      .slice(Math.max(i, 0) + 1)
      .find(
        (l) =>
          looksLikeName(l) &&
          (isUpperName(l) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(l)) &&
          l.split(" ").length <= 3,
      );
    if (cand) prenom = cand;
  }

  const clean = (s: string) =>
    titleCase(
      s
        .replace(/\b(noms?|pr[ée]noms?)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
  return { nom: clean(nom), prenom: clean(prenom) };
}

interface IdScanDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (nom: string, prenom: string) => void;
}

/** Scan facultatif de la carte d'identité : caméra + OCR local. Ne bloque jamais la saisie manuelle. */
export function IdScanDialog({ open, onOpenChange, onApply }: IdScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [detected, setDetected] = useState({ nom: "", prenom: "" });
  const [retry, setRetry] = useState(0);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    let cancelled = false;
    setPhase("camera");
    setError("");
    setPhoto(null);
    setDetected({ nom: "", prenom: "" });
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Caméra inaccessible. Autorisez la caméra dans le navigateur, ou saisissez le nom manuellement.",
          );
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, retry]);

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const shot = document.createElement("canvas");
    shot.width = w;
    shot.height = h;
    const sctx = shot.getContext("2d");
    if (!sctx) return;
    sctx.drawImage(video, 0, 0);
    const url = shot.toDataURL("image/jpeg", 0.92);
    setPhoto(url);
    stop();
    setPhase("busy");
    try {
      // Copie agrandie, en niveaux de gris et contrastée : l'OCR lit mieux les petites cartes.
      const scale = 2;
      const oc = document.createElement("canvas");
      oc.width = w * scale;
      oc.height = h * scale;
      const octx = oc.getContext("2d");
      if (!octx) throw new Error("canvas");
      octx.imageSmoothingEnabled = true;
      octx.drawImage(shot, 0, 0, oc.width, oc.height);
      const img = octx.getImageData(0, 0, oc.width, oc.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
        const v = Math.max(0, Math.min(255, (g - 128) * 1.5 + 128));
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      octx.putImageData(img, 0, 0);
      const ocrUrl = oc.toDataURL("image/png");

      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("fra");
      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        const res = await worker.recognize(ocrUrl);
        const parsed = parseIdText(res.data.text);
        if (!parsed.nom && !parsed.prenom) throw new Error("empty");
        setDetected(parsed);
        setPhase("result");
      } finally {
        await worker.terminate();
      }
    } catch {
      setError(
        "Lecture automatique impossible sur cette image. Réessayez avec une photo plus nette, ou saisissez le nom manuellement.",
      );
      setPhase("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" /> Scanner la carte d'identité
          </DialogTitle>
        </DialogHeader>

        {phase === "camera" && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            </div>
            <p className="text-xs text-muted-foreground">
              Placez la carte d'identité bien à plat, dans un endroit éclairé, puis capturez.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={() => void capture()}>
                <Camera className="mr-1.5 h-4 w-4" /> Capturer
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "busy" && (
          <div className="flex flex-col items-center gap-3 py-8">
            {photo && (
              <img src={photo} alt="Carte capturée" className="max-h-32 rounded-lg border border-border" />
            )}
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyse de la carte en cours…</p>
          </div>
        )}

        {phase === "result" && (
          <div className="space-y-4">
            {photo && (
              <img src={photo} alt="Carte capturée" className="max-h-28 rounded-lg border border-border" />
            )}
            <p className="text-xs text-muted-foreground">
              Vérifiez et corrigez si nécessaire avant d'utiliser ces informations.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom détecté">
                <Input
                  value={detected.nom}
                  onChange={(e) => setDetected({ ...detected, nom: e.target.value })}
                />
              </Field>
              <Field label="Prénom détecté">
                <Input
                  value={detected.prenom}
                  onChange={(e) => setDetected({ ...detected, prenom: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRetry((r) => r + 1)}>
                Recommencer
              </Button>
              <Button type="button" onClick={() => onApply(detected.nom, detected.prenom)}>
                Utiliser ces informations
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
              {error}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Saisir manuellement
              </Button>
              <Button type="button" onClick={() => setRetry((r) => r + 1)}>
                Réessayer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

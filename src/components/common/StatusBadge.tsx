import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const TONES: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/12 text-destructive",
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-primary/10 text-primary",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function paymentTone(remaining: number, total: number): { label: string; tone: Tone } {
  if (remaining <= 0) return { label: "PAYÉ", tone: "success" };
  if (remaining >= total) return { label: "NON PAYÉ", tone: "danger" };
  return { label: "PARTIELLEMENT PAYÉ", tone: "warning" };
}

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "positive" | "negative" | "warning";
}

export function StatCard({ label, value, detail, icon: Icon, tone = "neutral" }: StatCardProps) {
  return (
    <Card className="min-h-[116px]">
      <CardContent className="flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon ? (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                tone === "positive" && "bg-emerald-50 text-emerald-700",
                tone === "negative" && "bg-rose-50 text-rose-700",
                tone === "warning" && "bg-amber-50 text-amber-700",
                tone === "neutral" && "bg-zinc-100 text-zinc-700"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <div>
          <p
            className={cn(
              "mt-3 break-words text-2xl font-semibold tracking-normal",
              tone === "positive" && "text-emerald-700",
              tone === "negative" && "text-rose-700",
              tone === "warning" && "text-amber-700"
            )}
          >
            {value}
          </p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
